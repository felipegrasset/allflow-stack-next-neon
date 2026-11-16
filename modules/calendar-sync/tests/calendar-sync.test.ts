/**
 * calendar-sync — todo lo que se puede probar SIN base de datos ni red:
 * criptografía (llave, AES-256-GCM, state, PKCE, ids de evento), configuración
 * (redirect_uri fijo), el cliente de Google contra un `fetch` falso, los dos
 * handlers de OAuth (anti-CSRF, un solo uso, alcances) y el motor de
 * sincronización (idempotencia, renovación, revocación, reintentos,
 * reconciliación) con un almacén en memoria. `kyselyStore` necesita Postgres:
 * sin probar acá.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import type { BookingSnapshot, DisconnectReason, SyncState } from "../contracts/types"
import { es } from "../messages"
import { readConfig, normalizeBaseUrl, type CalendarConfig } from "../server/config"
import {
  CalendarKeyError,
  aadFor,
  decryptSecret,
  deriveKeys,
  encryptSecret,
  eventIdFor,
  parseMasterKey,
  pkceChallenge,
  pkcePair,
  signState,
  verifyState,
} from "../server/crypto"
import { CALENDAR_SCOPE, GOOGLE_AUTH_URL, GOOGLE_REVOKE_URL, GOOGLE_TOKEN_URL, googleClient } from "../server/google"
import { handleCallback, handleConnect, STATE_TTL_MS, type OAuthDeps, type Viewer } from "../server/oauth"
import type { AccountRow, CalendarSyncStore, EventRow, StateRow } from "../server/store"
import { MAX_ATTEMPTS, reconcile, syncBooking, type ReconcileDeps } from "../server/sync"

const HEX_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
const KEYS = deriveKeys(parseMasterKey(HEX_KEY))
const ENV = { GOOGLE_CLIENT_ID: "client-id.apps.test", GOOGLE_CLIENT_SECRET: "client-secret-x", CALENDAR_SYNC_KEY: HEX_KEY }
const BASE = "https://app.test"
const T0 = new Date("2026-11-16T12:00:00Z")

// ── almacén en memoria con la semántica de kyselyStore ──────────────────────

function memoryStore() {
  const accounts = new Map<string, AccountRow>()
  const states = new Map<string, StateRow>()
  const events = new Map<string, EventRow>()
  const store: CalendarSyncStore = {
    async getAccount(userId) {
      const a = accounts.get(userId)
      return a ? { ...a } : null
    },
    async saveConnected(a) {
      accounts.set(a.userId, {
        userId: a.userId,
        status: "connected",
        disconnectReason: null,
        scopes: a.scopes,
        calendarId: "primary",
        accessTokenEnc: a.accessTokenEnc,
        accessExpiresAt: a.accessExpiresAt,
        refreshTokenEnc: a.refreshTokenEnc,
        connectedAt: a.at,
        updatedAt: a.at,
      })
    },
    async updateAccessToken(userId, enc, expiresAt, at) {
      const a = accounts.get(userId)
      if (a && a.status === "connected") Object.assign(a, { accessTokenEnc: enc, accessExpiresAt: expiresAt, updatedAt: at })
    },
    async markDisconnected(userId, reason, at) {
      const a = accounts.get(userId)
      if (!a || a.status !== "connected") return false
      Object.assign(a, {
        status: "disconnected",
        disconnectReason: reason,
        accessTokenEnc: null,
        accessExpiresAt: null,
        refreshTokenEnc: null,
        updatedAt: at,
      })
      return true
    },
    async listConnectedUserIds() {
      return [...accounts.values()].filter((a) => a.status === "connected").map((a) => a.userId)
    },
    async createState(s) {
      states.set(s.nonce, { ...s })
    },
    async consumeState(nonce, userId, now) {
      const s = states.get(nonce)
      if (!s || s.userId !== userId || s.expiresAt <= now) return null
      states.delete(nonce)
      return s
    },
    async purgeExpiredStates(now) {
      let n = 0
      for (const [k, s] of states) if (s.expiresAt <= now) (states.delete(k), n++)
      return n
    },
    async getEvent(id) {
      const e = events.get(id)
      return e ? { ...e } : null
    },
    async putEvent(row) {
      events.set(row.bookingId, { ...row })
    },
    async listDueEvents(now, limit) {
      return [...events.values()]
        .filter((e) => (e.state === "pending" || e.state === "failed") && e.nextAttemptAt && e.nextAttemptAt <= now)
        .slice(0, limit)
    },
    async countEvents(userId) {
      const out: Record<SyncState, number> = { pending: 0, synced: 0, failed: 0, skipped: 0 }
      for (const e of events.values()) if (e.userId === userId) out[e.state]++
      return out
    },
  }
  return { store, accounts, states, events }
}

// ── fetch falso que graba lo pedido ─────────────────────────────────────────

type Call = { method: string; url: string; body: string; auth: string | null }
type Handler = (c: Call) => Response | Promise<Response>

function fakeFetch(handler: Handler) {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const c: Call = {
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body ? String(init.body) : "",
      auth: headers.get("authorization"),
    }
    calls.push(c)
    return handler(c)
  }) as typeof fetch
  return { fn, calls }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function tokenResponse(over: Record<string, unknown> = {}) {
  return json(200, {
    access_token: "ya29.access-NEW",
    expires_in: 3599,
    refresh_token: "1//refresh-SECRET",
    scope: CALENDAR_SCOPE,
    token_type: "Bearer",
    ...over,
  })
}

// ── criptografía ────────────────────────────────────────────────────────────

test("llave: exige 64 hex y nunca repite el valor en el error", () => {
  assert.equal(parseMasterKey(HEX_KEY).length, 32)
  for (const bad of ["", "abc", HEX_KEY.slice(1), HEX_KEY + "0", "zz" + HEX_KEY.slice(2), undefined]) {
    assert.throws(
      () => parseMasterKey(bad),
      (e: unknown) => e instanceof CalendarKeyError && !(bad && (e as Error).message.includes(bad))
    )
  }
  assert.notDeepEqual(KEYS.enc, KEYS.mac)
  assert.deepEqual(deriveKeys(parseMasterKey(HEX_KEY)).enc, KEYS.enc)
})

test("AES-256-GCM: ida y vuelta, IV aleatorio, etiqueta y AAD verificadas", () => {
  const aad = aadFor.refresh("u1")
  const a = encryptSecret(KEYS.enc, "1//refresh-SECRET", aad)
  const b = encryptSecret(KEYS.enc, "1//refresh-SECRET", aad)
  assert.notEqual(a, b, "IV distinto en cada valor")
  assert.ok(!a.includes("refresh-SECRET"))
  assert.equal(a.split(".")[0], "v1")
  assert.equal(Buffer.from(a.split(".")[1], "base64url").length, 12)
  assert.equal(Buffer.from(a.split(".")[2], "base64url").length, 16)
  assert.equal(decryptSecret(KEYS.enc, a, aad), "1//refresh-SECRET")

  const [v, iv, tag, ct] = a.split(".")
  const flip = (s: string) => {
    const buf = Buffer.from(s, "base64url")
    buf[0] ^= 1
    return buf.toString("base64url")
  }
  assert.throws(() => decryptSecret(KEYS.enc, [v, iv, tag, flip(ct)].join("."), aad), /authentication/)
  assert.throws(() => decryptSecret(KEYS.enc, [v, iv, flip(tag), ct].join("."), aad), /authentication/)
  assert.throws(() => decryptSecret(KEYS.enc, [v, flip(iv), tag, ct].join("."), aad), /authentication/)
  assert.throws(() => decryptSecret(KEYS.enc, a, aadFor.refresh("u2")), /authentication/, "otra fila")
  assert.throws(() => decryptSecret(KEYS.enc, a, aadFor.access("u1")), /authentication/, "otro campo")
  assert.throws(() => decryptSecret(KEYS.mac, a, aad), /authentication/, "otra llave")
  assert.throws(() => decryptSecret(KEYS.enc, [v, iv, tag.slice(0, 10), ct].join("."), aad), /malformed/)
  assert.throws(() => decryptSecret(KEYS.enc, "texto-plano", aad), /malformed/)
})

test("state: firmado para la sesión, rechaza otra sesión, alteraciones y basura", () => {
  const s = signState(KEYS.mac, "nonce-abc_123", "sess-1")
  assert.equal(verifyState(KEYS.mac, s, "sess-1"), "nonce-abc_123")
  assert.equal(verifyState(KEYS.mac, s, "sess-2"), null)
  assert.equal(verifyState(KEYS.enc, s, "sess-1"), null)
  assert.equal(verifyState(KEYS.mac, s.replace("nonce-abc", "nonce-abd"), "sess-1"), null)
  assert.equal(verifyState(KEYS.mac, s.slice(0, -2), "sess-1"), null)
  for (const junk of ["", ".", "a.b.c", "nonce", "a+b.c", "x".repeat(300)])
    assert.equal(verifyState(KEYS.mac, junk, "sess-1"), null)
})

test("PKCE S256: challenge = base64url(sha256(verifier)) sin relleno, verificador nuevo cada vez", () => {
  const v = "verificador-de-prueba-con-43-caracteres-xyz"
  assert.equal(pkceChallenge(v), createHash("sha256").update(v, "ascii").digest("base64url"))
  assert.match(pkceChallenge(v), /^[A-Za-z0-9_-]{43}$/)
  const p = pkcePair()
  assert.equal(p.verifier.length, 43)
  assert.notEqual(p.verifier, pkcePair().verifier)
  assert.equal(p.challenge, pkceChallenge(p.verifier))
})

test("id de evento: base32hex, 5–1024, determinista por reserva y usuario", () => {
  const id = eventIdFor("bk_1", "u1")
  assert.match(id, /^[0-9a-v]{5,1024}$/)
  assert.equal(id, eventIdFor("bk_1", "u1"))
  assert.notEqual(id, eventIdFor("bk_2", "u1"))
  assert.notEqual(id, eventIdFor("bk_1", "u2"))
})

// ── configuración ───────────────────────────────────────────────────────────

test("config: redirect_uri fijo desde la URL de la app; faltantes por nombre", () => {
  const c = readConfig(ENV, "https://app.test/cualquier/ruta")
  assert.ok(c.ok)
  if (c.ok) {
    assert.equal(c.redirectUri, "https://app.test/api/calendar-sync/callback")
    assert.equal(c.settingsUrl, "https://app.test/settings/calendar")
  }
  const m = readConfig({}, BASE)
  assert.ok(!m.ok)
  if (!m.ok) assert.deepEqual(m.missing, ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CALENDAR_SYNC_KEY"])
  const k = readConfig({ ...ENV, CALENDAR_SYNC_KEY: "corta" }, BASE)
  assert.ok(!k.ok && k.keyInvalid && k.missing.includes("CALENDAR_SYNC_KEY"))
  assert.equal(normalizeBaseUrl("http://evil.test"), null)
  assert.equal(normalizeBaseUrl("http://localhost:3000/x"), "http://localhost:3000")
  assert.equal(normalizeBaseUrl("no-es-url"), null)
  const nb = readConfig(ENV, "http://app.test")
  assert.ok(!nb.ok && nb.missing.includes("BETTER_AUTH_URL"))
})

// ── cliente de Google ───────────────────────────────────────────────────────

const OPTS = { clientId: "cid", clientSecret: "csecret", redirectUri: `${BASE}/api/calendar-sync/callback` }

test("Google: URL de consentimiento con un solo alcance, offline, consent y PKCE", () => {
  const u = new URL(googleClient(OPTS).authUrl({ state: "st", codeChallenge: "ch" }))
  assert.equal(`${u.origin}${u.pathname}`, GOOGLE_AUTH_URL)
  const p = u.searchParams
  assert.equal(p.get("scope"), "https://www.googleapis.com/auth/calendar.events.owned")
  assert.equal(p.get("redirect_uri"), OPTS.redirectUri)
  assert.equal(p.get("response_type"), "code")
  assert.equal(p.get("access_type"), "offline")
  assert.equal(p.get("prompt"), "consent")
  assert.equal(p.get("code_challenge_method"), "S256")
  assert.equal(p.get("state"), "st")
})

test("Google: canje y renovación; invalid_grant = revocado", async () => {
  const f = fakeFetch((c) =>
    c.body.includes("grant_type=refresh_token") ? json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }) : tokenResponse()
  )
  const g = googleClient({ ...OPTS, fetch: f.fn })
  const ex = await g.exchangeCode("4/code", "verifier-x")
  assert.ok(ex.ok && ex.tokens.refreshToken === "1//refresh-SECRET")
  const body = new URLSearchParams(f.calls[0].body)
  assert.equal(f.calls[0].url, GOOGLE_TOKEN_URL)
  assert.equal(body.get("grant_type"), "authorization_code")
  assert.equal(body.get("code_verifier"), "verifier-x")
  assert.equal(body.get("redirect_uri"), OPTS.redirectUri)
  const rf = await g.refresh("1//refresh-SECRET")
  assert.deepEqual(rf, { ok: false, revoked: true, code: "invalid_grant" })
  const net = await googleClient({ ...OPTS, fetch: (async () => { throw new Error("down") }) as typeof fetch }).refresh("x")
  assert.deepEqual(net, { ok: false, revoked: false, code: "network" })
})

test("Google: insert con id propio, 409 → PATCH; delete 410 = hecho; 403 se clasifica", async () => {
  const f = fakeFetch((c) => (c.method === "POST" ? json(409, { error: { errors: [{ reason: "duplicate" }] } }) : json(200, {})))
  const g = googleClient({ ...OPTS, fetch: f.fn })
  const ev = {
    summary: "Reserva: Sala",
    start: { dateTime: "2026-11-17T13:00:00.000Z", timeZone: "America/Santiago" },
    end: { dateTime: "2026-11-17T14:00:00.000Z", timeZone: "America/Santiago" },
    status: "confirmed" as const,
    extendedProperties: { private: { fulviaBookingId: "bk" } },
  }
  assert.deepEqual(await g.upsertEvent("tok", "primary", "fvabc123", ev), { ok: true })
  assert.equal(f.calls[0].url, "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none")
  assert.equal(JSON.parse(f.calls[0].body).id, "fvabc123")
  assert.equal(f.calls[1].method, "PATCH")
  assert.match(f.calls[1].url, /\/events\/fvabc123\?/)
  assert.equal(f.calls[1].auth, "Bearer tok")

  const gone = googleClient({ ...OPTS, fetch: fakeFetch(() => json(410, {})).fn })
  assert.deepEqual(await gone.deleteEvent("tok", "primary", "fvabc123"), { ok: true })
  const rate = googleClient({ ...OPTS, fetch: fakeFetch(() => json(403, { error: { errors: [{ reason: "rateLimitExceeded" }] } })).fn })
  assert.equal((await rate.deleteEvent("t", "primary", "x") as { kind: string }).kind, "retryable")
  const scope = googleClient({ ...OPTS, fetch: fakeFetch(() => json(403, { error: { errors: [{ reason: "insufficientPermissions" }] } })).fn })
  assert.equal((await scope.deleteEvent("t", "primary", "x") as { kind: string }).kind, "scope")
})

// ── handlers de OAuth ───────────────────────────────────────────────────────

function oauthSetup(over: { viewer?: Viewer | null; handler?: Handler; env?: Record<string, string> } = {}) {
  const mem = memoryStore()
  const f = fakeFetch(over.handler ?? (() => tokenResponse()))
  const logs: string[] = []
  let now = T0
  const viewer: Viewer | null = over.viewer === undefined ? { userId: "u1", sessionId: "sess-1", canConnect: true } : over.viewer
  const deps: OAuthDeps & { setViewer: (v: Viewer | null) => void; setNow: (d: Date) => void } = {
    config: () => readConfig(over.env ?? ENV, BASE),
    viewer: async () => current,
    store: mem.store,
    google: (cfg: Extract<CalendarConfig, { ok: true }>) =>
      googleClient({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri, fetch: f.fn }),
    now: () => now,
    log: (msg, meta) => logs.push(`${msg} ${JSON.stringify(meta ?? {})}`),
    setViewer: (v) => (current = v),
    setNow: (d) => (now = d),
  }
  let current = viewer
  return { deps, mem, f, logs }
}

async function startFlow(s: ReturnType<typeof oauthSetup>) {
  const res = await handleConnect(new Request(`${BASE}/api/calendar-sync/connect`), s.deps)
  assert.equal(res.status, 302)
  return new URL(res.headers.get("location")!).searchParams.get("state")!
}

const cb = (q: string) => new Request(`${BASE}/api/calendar-sync/callback?${q}`)

test("connect: sin sesión → login; sin permiso → 403; sin config → aviso", async () => {
  const anon = oauthSetup({ viewer: null })
  const r1 = await handleConnect(new Request(`${BASE}/x`), anon.deps)
  assert.equal(r1.headers.get("location"), `${BASE}/login?next=%2Fsettings%2Fcalendar`)
  const noPerm = oauthSetup({ viewer: { userId: "u1", sessionId: "s", canConnect: false } })
  assert.equal((await handleConnect(new Request(`${BASE}/x`), noPerm.deps)).status, 403)
  assert.equal(noPerm.mem.states.size, 0)
  const noCfg = oauthSetup({ env: {} })
  const r3 = await handleConnect(new Request(`${BASE}/x`), noCfg.deps)
  assert.equal(r3.headers.get("location"), `${BASE}/settings/calendar?status=not_configured`)
})

test("connect: redirect_uri de la config aunque la petición traiga otro Host", async () => {
  const s = oauthSetup()
  const req = new Request("https://evil.test/api/calendar-sync/connect", {
    headers: { host: "evil.test", "x-forwarded-host": "evil.test" },
  })
  const res = await handleConnect(req, s.deps)
  const loc = new URL(res.headers.get("location")!)
  assert.equal(loc.searchParams.get("redirect_uri"), `${BASE}/api/calendar-sync/callback`)
  assert.equal(res.headers.get("cache-control"), "no-store")
  assert.equal(s.mem.states.size, 1)
  const st = [...s.mem.states.values()][0]
  assert.equal(st.userId, "u1")
  assert.equal(st.expiresAt.getTime(), T0.getTime() + STATE_TTL_MS)
  assert.ok(!st.verifierEnc.includes(loc.searchParams.get("code_challenge")!))
})

test("callback: conecta, guarda tokens cifrados, envía el verificador PKCE y no loguea secretos", async () => {
  const s = oauthSetup()
  const state = await startFlow(s)
  const res = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=4%2Fcode-XYZ`), s.deps)
  assert.equal(res.headers.get("location"), `${BASE}/settings/calendar?status=connected`)
  assert.equal(res.headers.get("referrer-policy"), "no-referrer")
  const a = s.mem.accounts.get("u1")!
  assert.equal(a.status, "connected")
  assert.ok(!a.refreshTokenEnc!.includes("refresh-SECRET") && !a.accessTokenEnc!.includes("access-NEW"))
  assert.equal(decryptSecret(KEYS.enc, a.refreshTokenEnc!, aadFor.refresh("u1")), "1//refresh-SECRET")
  assert.equal(a.accessExpiresAt!.getTime(), T0.getTime() + 3599_000)
  const tokenCall = new URLSearchParams(s.f.calls[0].body)
  assert.equal(tokenCall.get("code"), "4/code-XYZ")
  assert.equal(tokenCall.get("redirect_uri"), `${BASE}/api/calendar-sync/callback`)
  assert.equal(tokenCall.get("code_verifier")!.length, 43)
  const all = s.logs.join("\n")
  for (const secret of ["refresh-SECRET", "access-NEW", "code-XYZ", "client-secret-x", state])
    assert.ok(!all.includes(secret), `log sin ${secret}`)
})

test("callback: el state es de un solo uso", async () => {
  const s = oauthSetup()
  const state = await startFlow(s)
  await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c1`), s.deps)
  const again = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c2`), s.deps)
  assert.equal(again.headers.get("location"), `${BASE}/settings/calendar?status=state`)
  assert.equal(s.f.calls.length, 1, "el segundo intento no llega a Google")
})

test("callback: state de otra sesión, de otro usuario, vencido o ausente → rechazado sin llamar a Google", async () => {
  const s = oauthSetup()
  const state = await startFlow(s)
  s.deps.setViewer({ userId: "u1", sessionId: "sess-OTHER", canConnect: true })
  const r1 = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c`), s.deps)
  assert.equal(r1.headers.get("location"), `${BASE}/settings/calendar?status=state`)
  assert.equal(s.mem.states.size, 1, "firma mala: ni siquiera consume el state")

  // Mismo id de sesión pero otro usuario (no debería pasar; la fila igual lo exige).
  s.deps.setViewer({ userId: "u2", sessionId: "sess-1", canConnect: true })
  const r2 = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c`), s.deps)
  assert.equal(r2.headers.get("location"), `${BASE}/settings/calendar?status=state`)

  s.deps.setViewer({ userId: "u1", sessionId: "sess-1", canConnect: true })
  s.deps.setNow(new Date(T0.getTime() + STATE_TTL_MS + 1))
  const r3 = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c`), s.deps)
  assert.equal(r3.headers.get("location"), `${BASE}/settings/calendar?status=state`)
  const r4 = await handleCallback(cb(`code=c`), s.deps)
  assert.equal(r4.headers.get("location"), `${BASE}/settings/calendar?status=state`)
  assert.equal(s.f.calls.length, 0)
  assert.equal(s.mem.accounts.size, 0)
})

test("callback: cancelar en Google → denied (y el state queda usado)", async () => {
  const s = oauthSetup()
  const state = await startFlow(s)
  const r = await handleCallback(cb(`state=${encodeURIComponent(state)}&error=access_denied`), s.deps)
  assert.equal(r.headers.get("location"), `${BASE}/settings/calendar?status=denied`)
  assert.equal(s.mem.states.size, 0)
})

test("callback: sin el alcance del calendario → scope, revoca y no guarda", async () => {
  const s = oauthSetup({
    handler: (c) => (c.url === GOOGLE_REVOKE_URL ? json(200, {}) : tokenResponse({ scope: "openid" })),
  })
  const state = await startFlow(s)
  const r = await handleCallback(cb(`state=${encodeURIComponent(state)}&code=c`), s.deps)
  assert.equal(r.headers.get("location"), `${BASE}/settings/calendar?status=scope`)
  assert.equal(s.mem.accounts.size, 0)
  assert.ok(s.f.calls.some((c) => c.url === GOOGLE_REVOKE_URL))
})

// ── motor de sincronización ─────────────────────────────────────────────────

const BOOKING: BookingSnapshot = {
  id: "bk_1",
  userId: "u1",
  status: "confirmed",
  startsAt: new Date("2026-11-17T13:00:00Z"),
  endsAt: new Date("2026-11-17T14:00:00Z"),
  resourceName: "Sala Pehuén",
  timezone: "America/Santiago",
}

function syncSetup(handler: Handler, opts: { connected?: boolean; accessValid?: boolean; ready?: boolean } = {}) {
  const mem = memoryStore()
  const f = fakeFetch(handler)
  const logs: string[] = []
  const notices: { userId: string; reason: DisconnectReason }[] = []
  let now = T0
  if (opts.connected !== false) {
    mem.accounts.set("u1", {
      userId: "u1",
      status: "connected",
      disconnectReason: null,
      scopes: CALENDAR_SCOPE,
      calendarId: "primary",
      accessTokenEnc: encryptSecret(KEYS.enc, "ya29.access-OLD", aadFor.access("u1")),
      accessExpiresAt: new Date(T0.getTime() + (opts.accessValid === false ? -1000 : 30 * 60_000)),
      refreshTokenEnc: encryptSecret(KEYS.enc, "1//refresh-SECRET", aadFor.refresh("u1")),
      connectedAt: T0,
      updatedAt: T0,
    })
  }
  const bookings: BookingSnapshot[] = []
  const deps: ReconcileDeps = {
    store: mem.store,
    ready: opts.ready === false ? null : { google: googleClient({ ...OPTS, fetch: f.fn }), keys: KEYS },
    now: () => now,
    log: (msg, meta) => logs.push(`${msg} ${JSON.stringify(meta ?? {})}`),
    onDisconnected: async (userId, reason) => {
      notices.push({ userId, reason })
    },
    text: {
      summary: (r) => es["calendar-sync"].event.summary.replace("{resource}", r),
      description: es["calendar-sync"].event.description,
    },
    listBookings: async ({ userId }) => bookings.filter((b) => b.userId === userId),
  }
  return { deps, mem, f, logs, notices, bookings, setNow: (d: Date) => (now = d) }
}

const api = (c: Call) => c.url.startsWith("https://www.googleapis.com/calendar/v3/")

test("sync: crea el evento con id determinista y es idempotente", async () => {
  const s = syncSetup(() => json(200, { id: "x" }))
  assert.equal(await syncBooking(s.deps, BOOKING), "synced")
  const ins = s.f.calls[0]
  assert.equal(ins.method, "POST")
  assert.equal(ins.auth, "Bearer ya29.access-OLD")
  const body = JSON.parse(ins.body)
  assert.equal(body.id, eventIdFor("bk_1", "u1"))
  assert.equal(body.summary, "Reserva: Sala Pehuén")
  assert.deepEqual(body.start, { dateTime: "2026-11-17T13:00:00.000Z", timeZone: "America/Santiago" })
  assert.equal(body.extendedProperties.private.fulviaBookingId, "bk_1")
  assert.equal(s.mem.events.get("bk_1")!.state, "synced")

  assert.equal(await syncBooking(s.deps, BOOKING), "unchanged")
  assert.equal(s.f.calls.length, 1, "sin cambios no se llama a Google")
  // Otra hora (misma reserva): mismo evento, actualizado.
  assert.equal(await syncBooking(s.deps, { ...BOOKING, endsAt: new Date("2026-11-17T14:30:00Z") }), "synced")
  assert.equal(JSON.parse(s.f.calls[1].body).id, body.id)
})

test("sync: cancelar borra el evento; 404 cuenta como hecho; cancelada sin evento no llama", async () => {
  const s = syncSetup((c) => (c.method === "DELETE" ? json(404, {}) : json(200, {})))
  await syncBooking(s.deps, BOOKING)
  assert.equal(await syncBooking(s.deps, { ...BOOKING, status: "cancelled" }), "deleted")
  assert.equal(s.f.calls[1].method, "DELETE")
  assert.match(s.f.calls[1].url, new RegExp(`/events/${eventIdFor("bk_1", "u1")}\\?`))
  assert.equal(await syncBooking(s.deps, { ...BOOKING, status: "cancelled" }), "unchanged")
  assert.equal(await syncBooking(s.deps, { ...BOOKING, id: "bk_never", status: "cancelled" }), "unchanged")
  assert.equal(s.f.calls.length, 2)
})

test("sync: token vencido → renueva, guarda el nuevo cifrado y lo usa", async () => {
  const s = syncSetup((c) => (c.url === GOOGLE_TOKEN_URL ? tokenResponse({ refresh_token: undefined }) : json(200, {})), {
    accessValid: false,
  })
  assert.equal(await syncBooking(s.deps, BOOKING), "synced")
  assert.equal(s.f.calls[0].url, GOOGLE_TOKEN_URL)
  assert.equal(new URLSearchParams(s.f.calls[0].body).get("refresh_token"), "1//refresh-SECRET")
  assert.equal(s.f.calls[1].auth, "Bearer ya29.access-NEW")
  const a = s.mem.accounts.get("u1")!
  assert.equal(decryptSecret(KEYS.enc, a.accessTokenEnc!, aadFor.access("u1")), "ya29.access-NEW")
  assert.ok(!a.accessTokenEnc!.includes("access-NEW"))
})

test("sync: 401 con token vigente → renueva una vez y reintenta una vez", async () => {
  let first = true
  const s = syncSetup((c) => {
    if (c.url === GOOGLE_TOKEN_URL) return tokenResponse()
    if (first) {
      first = false
      return json(401, { error: { errors: [{ reason: "authError" }] } })
    }
    return json(200, {})
  })
  assert.equal(await syncBooking(s.deps, BOOKING), "synced")
  assert.deepEqual(
    s.f.calls.map((c) => (c.url === GOOGLE_TOKEN_URL ? "token" : c.method)),
    ["POST", "token", "POST"]
  )
})

test("sync: Google revoca (invalid_grant) → cuenta desconectada, un aviso, la reserva se guarda para después", async () => {
  const s = syncSetup((c) => (c.url === GOOGLE_TOKEN_URL ? json(400, { error: "invalid_grant" }) : json(200, {})), {
    accessValid: false,
  })
  assert.equal(await syncBooking(s.deps, BOOKING), "disconnected")
  const a = s.mem.accounts.get("u1")!
  assert.equal(a.status, "disconnected")
  assert.equal(a.disconnectReason, "revoked")
  assert.equal(a.refreshTokenEnc, null)
  assert.equal(a.accessTokenEnc, null)
  assert.deepEqual(s.notices, [{ userId: "u1", reason: "revoked" }])
  assert.equal(s.mem.events.get("bk_1")!.state, "skipped")
  assert.equal(await syncBooking(s.deps, { ...BOOKING, id: "bk_2" }), "disconnected")
  assert.equal(s.notices.length, 1, "un solo aviso por desconexión")
  assert.equal(s.f.calls.filter(api).length, 0)
})

test("sync: 403 sin permiso del calendario → desconecta por alcance y avisa", async () => {
  const s = syncSetup(() => json(403, { error: { errors: [{ reason: "insufficientPermissions" }] } }))
  assert.equal(await syncBooking(s.deps, BOOKING), "disconnected")
  assert.equal(s.mem.accounts.get("u1")!.disconnectReason, "scope")
  assert.deepEqual(s.notices, [{ userId: "u1", reason: "scope" }])
})

test("sync: Google cae → reintento programado; la reconciliación lo completa después", async () => {
  let down = true
  const s = syncSetup(() => (down ? json(503, {}) : json(200, {})))
  assert.equal(await syncBooking(s.deps, BOOKING), "retry")
  const row = s.mem.events.get("bk_1")!
  assert.equal(row.state, "failed")
  assert.equal(row.attempts, 1)
  assert.equal(row.lastError, "http_503")
  assert.equal(row.nextAttemptAt!.getTime(), T0.getTime() + 60_000)
  // Mientras no toca, ni el gancho ni la reconciliación vuelven a llamar.
  assert.equal(await syncBooking(s.deps, BOOKING), "retry")
  assert.equal(s.f.calls.length, 1)

  down = false
  s.setNow(new Date(T0.getTime() + 61_000))
  const r = await reconcile(s.deps)
  assert.equal(r.retried, 1)
  assert.equal(r.outcomes.synced, 1)
  assert.equal(s.mem.events.get("bk_1")!.state, "synced")
  assert.equal(s.mem.events.get("bk_1")!.attempts, 0)
})

test("sync: se rinde tras MAX_ATTEMPTS y un 400 no se reintenta", async () => {
  const s = syncSetup(() => json(500, {}))
  await syncBooking(s.deps, BOOKING)
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    s.setNow(new Date(T0.getTime() + i * 3 * 86_400_000))
    await reconcile(s.deps)
  }
  const row = s.mem.events.get("bk_1")!
  assert.equal(row.state, "failed")
  assert.equal(row.nextAttemptAt, null)
  assert.equal(row.attempts, MAX_ATTEMPTS)

  const bad = syncSetup(() => json(400, { error: { errors: [{ reason: "invalid" }] } }))
  assert.equal(await syncBooking(bad.deps, BOOKING), "failed")
  assert.equal(bad.mem.events.get("bk_1")!.nextAttemptAt, null)
})

test("sync: sin cuenta o sin configuración no falla; al conectar, la reconciliación la envía", async () => {
  const s = syncSetup(() => json(200, {}), { connected: false })
  assert.equal(await syncBooking(s.deps, BOOKING), "no_account")
  assert.equal(s.mem.events.get("bk_1")!.state, "skipped")
  assert.equal(s.f.calls.length, 0)

  const off = syncSetup(() => json(200, {}), { ready: false })
  assert.equal(await syncBooking(off.deps, BOOKING), "not_configured")
  assert.equal(off.mem.events.get("bk_1")!.state, "pending")

  // Conecta (como lo deja el callback) y reconcilia solo a esa persona.
  await s.mem.store.saveConnected({
    userId: "u1",
    scopes: CALENDAR_SCOPE,
    accessTokenEnc: encryptSecret(KEYS.enc, "ya29.access-OLD", aadFor.access("u1")),
    accessExpiresAt: new Date(T0.getTime() + 3_600_000),
    refreshTokenEnc: encryptSecret(KEYS.enc, "1//refresh-SECRET", aadFor.refresh("u1")),
    at: T0,
  })
  s.bookings.push(BOOKING, { ...BOOKING, id: "bk_c", status: "cancelled" }, { ...BOOKING, id: "bk_other", userId: "u9" })
  const r = await reconcile(s.deps, { userId: "u1" })
  assert.equal(r.scanned, 2)
  assert.equal(r.outcomes.synced, 1)
  assert.equal(r.outcomes.unchanged, 1)
  assert.equal(s.mem.events.get("bk_1")!.state, "synced")
  assert.equal(s.mem.events.has("bk_other"), false)
  // Otra vez: nada que hacer.
  const again = await reconcile(s.deps, { userId: "u1" })
  assert.equal(again.outcomes.unchanged, 2)
  assert.equal(s.f.calls.length, 1)
})

test("sync: la reconciliación detecta una cancelación que nadie avisó", async () => {
  const s = syncSetup((c) => (c.method === "DELETE" ? new Response(null, { status: 204 }) : json(200, {})))
  s.bookings.push(BOOKING)
  await reconcile(s.deps)
  s.bookings[0] = { ...BOOKING, status: "cancelled" }
  const r = await reconcile(s.deps)
  assert.equal(r.outcomes.deleted, 1)
  assert.equal(s.f.calls.at(-1)!.method, "DELETE")
})

test("sync: los logs no llevan tokens, nombres del recurso ni el texto de Google", async () => {
  const s = syncSetup(
    (c) =>
      c.url === GOOGLE_TOKEN_URL
        ? tokenResponse()
        : json(400, { error: { message: "Sala Pehuén ya29.access-NEW", errors: [{ reason: "invalid" }] } }),
    { accessValid: false }
  )
  await syncBooking(s.deps, BOOKING)
  const all = s.logs.join("\n")
  for (const secret of ["access-NEW", "access-OLD", "refresh-SECRET", "Pehuén", "Sala"])
    assert.ok(!all.includes(secret), `log sin ${secret}`)
  assert.ok(all.includes("bk_1"))
})

test("textos: es y en con las mismas claves", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [`${p}${k}`] : keys(v as object, `${p}${k}.`)))
  return import("../messages").then((m) => assert.deepEqual(keys(m.en).sort(), keys(m.es).sort()))
})
