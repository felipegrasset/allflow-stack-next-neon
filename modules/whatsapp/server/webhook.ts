/**
 * The webhook's two handlers with every dependency injected (tests run them
 * without Next or a database). server/webhook/route.ts wires the real ones.
 *
 * POST, in this order (the order is the guarantee):
 *   1. not configured (no provider or no secret) → 401, nothing written
 *   2. body over 512 KB                         → 413, nothing written
 *   3. signature (HMAC-SHA256 of the raw body)  → 401 if wrong, nothing written
 *   4. JSON                                     → 400 if not
 *   5. events applied, idempotent               → 200
 *   A database error answers 500: Meta retries, and the retry changes nothing twice.
 *
 * Never logged: the body, the headers, a phone number, a message text.
 */
import { applyEvents, parseWebhookPayload, type ApplyDeps } from "./inbound"
import type { WhatsAppConfig } from "./config"
import { safeEqual, verifySignature } from "./signature"
import type { WhatsAppStore } from "./store"

export const MAX_WEBHOOK_BYTES = 512 * 1024

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })

export type WebhookDeps = {
  config: () => WhatsAppConfig
  store: () => WhatsAppStore
  onFailed?: ApplyDeps["onFailed"]
  now?: () => Date
  newId?: () => string
  /** Receives counts and error names only. */
  log?: (msg: string, meta?: Record<string, unknown>) => void
}

/** Meta's subscription handshake: echo `hub.challenge` if the verify token matches. */
export function handleVerify(req: Request, deps: Pick<WebhookDeps, "config">): Response {
  const cfg = deps.config()
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token") ?? ""
  const challenge = url.searchParams.get("hub.challenge") ?? ""
  if (
    cfg.provider !== "meta" ||
    !cfg.verifyToken ||
    mode !== "subscribe" ||
    !safeEqual(token, cfg.verifyToken) ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(challenge)
  ) {
    return new Response(null, { status: 403, headers: { "cache-control": "no-store" } })
  }
  return new Response(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  })
}

export async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  const cfg = deps.config()
  if (!cfg.provider || cfg.provider === "memory" || !cfg.webhookSecret) {
    deps.log?.("whatsapp: webhook not configured", { provider: cfg.provider })
    return json(401, { error: "unauthorized" })
  }

  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_WEBHOOK_BYTES) return json(413, { error: "too_large" })
  const raw = await req.text()
  if (Buffer.byteLength(raw, "utf8") > MAX_WEBHOOK_BYTES) return json(413, { error: "too_large" })

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), cfg.webhookSecret)) {
    deps.log?.("whatsapp: webhook signature rejected")
    return json(401, { error: "unauthorized" })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return json(400, { error: "bad_request" })
  }

  const now = deps.now ?? (() => new Date())
  try {
    const summary = await applyEvents(
      {
        store: deps.store(),
        provider: cfg.provider,
        phoneNumberId: cfg.phoneNumberId,
        onFailed: deps.onFailed,
        now,
        newId: deps.newId,
      },
      parseWebhookPayload(payload, now())
    )
    deps.log?.("whatsapp: webhook applied", summary)
    return json(200, { ok: true })
  } catch (err) {
    deps.log?.("whatsapp: webhook failed", { error: err instanceof Error ? err.name : "unknown" })
    return json(500, { error: "retry" })
  }
}
