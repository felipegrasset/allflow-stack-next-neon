/**
 * The two OAuth route handlers, with every dependency injected (tests/ call
 * them with fake fetch, store and session).
 *
 *   GET /api/calendar-sync/connect   → 302 to Google's consent screen
 *   GET /api/calendar-sync/callback  → exchanges the code, stores the tokens
 *                                      encrypted, 302 to /settings/calendar?status=…
 *
 * Anti-CSRF: `state` = nonce + HMAC(nonce, session id). The callback accepts
 * it only for the SAME session that started the flow (signature) and only
 * once (its row is deleted atomically, by the same user, before expiry). A
 * code obtained by someone else cannot be attached to this session.
 * PKCE (S256) on top: the verifier never leaves the server (stored encrypted).
 * The redirect_uri is the configured one, never derived from the request.
 *
 * Both handlers are public routes for the proxy: they check the session (and
 * `calendar:connect`) themselves. Responses carry `Cache-Control: no-store`
 * and `Referrer-Policy: no-referrer` (the callback URL holds the code).
 */
import { aadFor, decryptSecret, encryptSecret, newNonce, pkcePair, signState, verifyState } from "./crypto"
import type { CalendarConfig } from "./config"
import { hasCalendarScope, type GoogleClient } from "./google"
import type { ReturnStatus } from "./paths"
import type { CalendarSyncStore } from "./store"
import type { Log } from "./sync"

export const STATE_TTL_MS = 10 * 60_000

export type Viewer = { userId: string; sessionId: string; canConnect: boolean }

export type OAuthDeps = {
  config: () => CalendarConfig
  /** The signed-in person, or null. */
  viewer: () => Promise<Viewer | null>
  store: CalendarSyncStore
  google: (cfg: Extract<CalendarConfig, { ok: true }>) => GoogleClient
  now: () => Date
  log: Log
  /** After a successful connection: push the person's upcoming bookings (best effort). */
  afterConnect?: (userId: string) => Promise<void>
}

const SECURITY_HEADERS = { "cache-control": "no-store", "referrer-policy": "no-referrer" }

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location, ...SECURITY_HEADERS } })
}

function plain(status: number, text: string): Response {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS } })
}

function back(cfg: CalendarConfig, status: ReturnStatus): Response {
  if (!cfg.settingsUrl) return plain(503, "calendar-sync: not configured")
  return redirect(`${cfg.settingsUrl}?status=${status}`)
}

function loginRedirect(cfg: CalendarConfig): Response {
  if (!cfg.settingsUrl) return plain(401, "unauthorized")
  const u = new URL(cfg.settingsUrl)
  return redirect(`${u.origin}/login?next=${encodeURIComponent(u.pathname)}`)
}

export async function handleConnect(_req: Request, deps: OAuthDeps): Promise<Response> {
  const cfg = deps.config()
  const viewer = await deps.viewer()
  if (!viewer) return loginRedirect(cfg)
  if (!viewer.canConnect) return plain(403, "forbidden")
  if (!cfg.ok) return back(cfg, "not_configured")

  const nonce = newNonce()
  const { verifier, challenge } = pkcePair()
  await deps.store.createState({
    nonce,
    userId: viewer.userId,
    verifierEnc: encryptSecret(cfg.keys.enc, verifier, aadFor.verifier(nonce)),
    expiresAt: new Date(deps.now().getTime() + STATE_TTL_MS),
  })
  const state = signState(cfg.keys.mac, nonce, viewer.sessionId)
  return redirect(deps.google(cfg).authUrl({ state, codeChallenge: challenge }))
}

export async function handleCallback(req: Request, deps: OAuthDeps): Promise<Response> {
  const cfg = deps.config()
  const viewer = await deps.viewer()
  if (!viewer) return loginRedirect(cfg)
  if (!viewer.canConnect) return plain(403, "forbidden")
  if (!cfg.ok) return back(cfg, "not_configured")

  const params = new URL(req.url).searchParams
  const state = params.get("state") ?? ""
  const nonce = verifyState(cfg.keys.mac, state, viewer.sessionId)
  if (!nonce) {
    deps.log("calendar-sync: callback rejected", { reason: "state_signature" })
    return back(cfg, "state")
  }
  // Single use: deleted here, whatever happens next.
  const row = await deps.store.consumeState(nonce, viewer.userId, deps.now())
  if (!row) {
    deps.log("calendar-sync: callback rejected", { reason: "state_used_or_expired" })
    return back(cfg, "state")
  }
  if (params.get("error")) return back(cfg, "denied")
  const code = params.get("code")
  if (!code || code.length > 2048) return back(cfg, "error")

  let verifier: string
  try {
    verifier = decryptSecret(cfg.keys.enc, row.verifierEnc, aadFor.verifier(nonce))
  } catch {
    return back(cfg, "state")
  }
  const google = deps.google(cfg)
  const r = await google.exchangeCode(code, verifier)
  if (!r.ok) {
    deps.log("calendar-sync: code exchange failed", { code: r.code })
    return back(cfg, "error")
  }
  // Granular consent: the person may have unticked the calendar box.
  if (!hasCalendarScope(r.tokens.scope)) {
    await google.revoke(r.tokens.refreshToken ?? r.tokens.accessToken)
    return back(cfg, "scope")
  }
  if (!r.tokens.refreshToken) {
    deps.log("calendar-sync: code exchange failed", { code: "no_refresh_token" })
    return back(cfg, "error")
  }
  const now = deps.now()
  await deps.store.saveConnected({
    userId: viewer.userId,
    scopes: r.tokens.scope,
    accessTokenEnc: encryptSecret(cfg.keys.enc, r.tokens.accessToken, aadFor.access(viewer.userId)),
    accessExpiresAt: new Date(now.getTime() + r.tokens.expiresIn * 1000),
    refreshTokenEnc: encryptSecret(cfg.keys.enc, r.tokens.refreshToken, aadFor.refresh(viewer.userId)),
    at: now,
  })
  deps.log("calendar-sync: account connected", {})
  if (deps.afterConnect) {
    try {
      await deps.afterConnect(viewer.userId)
    } catch (err) {
      deps.log("calendar-sync: initial sync failed", { error: err instanceof Error ? err.name : "unknown" })
    }
  }
  return back(cfg, "connected")
}

/**
 * Disconnect at the person's request: revoke at Google (best effort) and wipe
 * the tokens. Events already created stay in their calendar.
 */
export async function disconnectAccount(
  deps: Pick<OAuthDeps, "store" | "now" | "log" | "config" | "google">,
  userId: string
): Promise<void> {
  const cfg = deps.config()
  const account = await deps.store.getAccount(userId)
  if (!account || account.status !== "connected") return
  if (cfg.ok && account.refreshTokenEnc) {
    try {
      const token = decryptSecret(cfg.keys.enc, account.refreshTokenEnc, aadFor.refresh(userId))
      await deps.google(cfg).revoke(token)
    } catch {
      deps.log("calendar-sync: revoke skipped", { reason: "undecryptable" })
    }
  }
  await deps.store.markDisconnected(userId, "user", deps.now())
}
