/**
 * push — everything that runs without a database or a browser: endpoint
 * allowlist, VAPID config, payload, the request to the push service (decrypted
 * back with the "browser" key), delivery against a fake push service
 * (404/410 delete the subscription, other errors keep it), the subscribe
 * handlers with injected deps, the service worker route, and, reading the
 * source, that the page and the action check session and permission.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { readVapidConfig, type VapidConfig } from "../server/config"
import {
  b64urlDecode,
  b64urlEncode,
  decryptPayload,
  generateVapidKeys,
  jwtClaims,
  verifyVapidJwt,
} from "../server/crypto/webpush"
import { checkEndpoint, endpointHost } from "../server/endpoint"
import { handleServiceWorker, handleSubscribe, handleUnsubscribe, type SubscribeDeps } from "../server/handlers"
import { pushPayloadSchema, sendOptionsSchema, wirePayload } from "../server/payload"
import { buildPushRequest } from "../server/request"
import { deliver, type DeliverDeps, type StoredSubscription } from "../server/send"
import { validateSubscription } from "../server/subscription"

/** Run from the repo root (as `pnpm test:modules` does). */
const MODULE_DIR = join(process.cwd(), "modules", "push")
const src = (rel: string) => readFileSync(join(MODULE_DIR, rel), "utf8")

const vapidKeys = generateVapidKeys()
const env = { VAPID_PUBLIC_KEY: vapidKeys.publicKey, VAPID_PRIVATE_KEY: vapidKeys.privateKey, VAPID_SUBJECT: "mailto:soporte@ejemplo.cl" }
const vapid = (() => {
  const r = readVapidConfig(env)
  if (!r.ok) throw new Error(r.error)
  return r.config
})()

/** A fake browser: a P-256 key pair and an auth secret. */
function browser(endpoint = "https://fcm.googleapis.com/fcm/send/abc123") {
  const k = generateVapidKeys()
  const auth = new Uint8Array(16).map((_, i) => i + 1)
  return {
    privateKey: b64urlDecode(k.privateKey),
    auth,
    sub: { endpoint, p256dh: k.publicKey, auth: b64urlEncode(auth) },
  }
}

// ── endpoint ────────────────────────────────────────────────────────────────

test("endpoint: only https on known push services", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/QGx",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])
    assert.ok(checkEndpoint(ok), ok)
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://evil.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example/x",
    "https://push.apple.com.evil.example/x",
    "https://169.254.169.254/latest",
    "https://localhost/x",
    "not a url",
    "",
    "https://fcm.googleapis.com/" + "a".repeat(3000),
  ])
    assert.equal(checkEndpoint(bad), null, bad)
  assert.equal(endpointHost("https://fcm.googleapis.com/fcm/send/secret"), "fcm.googleapis.com")
})

// ── config ──────────────────────────────────────────────────────────────────

test("config: needs the three vars, a matching pair and a valid subject", () => {
  assert.deepEqual(readVapidConfig({}), { ok: false, error: "missing" })
  assert.deepEqual(readVapidConfig({ ...env, VAPID_PUBLIC_KEY: "abc" }), { ok: false, error: "invalid_public_key" })
  assert.deepEqual(readVapidConfig({ ...env, VAPID_PRIVATE_KEY: "abc" }), { ok: false, error: "invalid_private_key" })
  assert.deepEqual(readVapidConfig({ ...env, VAPID_PRIVATE_KEY: generateVapidKeys().privateKey }), {
    ok: false,
    error: "key_mismatch",
  })
  for (const s of ["soporte@ejemplo.cl", "http://ejemplo.cl", "https://localhost", "mailto:"])
    assert.deepEqual(readVapidConfig({ ...env, VAPID_SUBJECT: s }), { ok: false, error: "invalid_subject" }, s)
  assert.equal(readVapidConfig({ ...env, VAPID_SUBJECT: "https://ejemplo.cl/contacto" }).ok, true)
  assert.equal(vapid.publicKeyText, vapidKeys.publicKey)
})

// ── payload ─────────────────────────────────────────────────────────────────

test("payload: internal href only; wire JSON uses `url`", () => {
  for (const href of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)"])
    assert.equal(pushPayloadSchema.safeParse({ title: "x", href }).success, false, href)
  assert.equal(pushPayloadSchema.safeParse({ title: " " }).success, false)
  const p = pushPayloadSchema.parse({ title: "Hola", body: "Cuerpo", href: "/orders/1", tag: "t1" })
  assert.deepEqual(JSON.parse(new TextDecoder().decode(wirePayload(p))), {
    title: "Hola",
    body: "Cuerpo",
    url: "/orders/1",
    tag: "t1",
  })
  assert.deepEqual(sendOptionsSchema.parse(undefined), { ttl: 86400, urgency: "normal" })
  assert.equal(sendOptionsSchema.safeParse({ topic: "has space" }).success, false)
})

// ── request ─────────────────────────────────────────────────────────────────

test("request: RFC 8030/8291/8292 headers and a body the browser can decrypt", () => {
  const b = browser()
  const plaintext = wirePayload(pushPayloadSchema.parse({ title: "Hola", href: "/x" }))
  const req = buildPushRequest({
    subscription: b.sub,
    plaintext,
    vapid,
    options: sendOptionsSchema.parse({ ttl: 60, urgency: "high", topic: "pedido-1" }),
    nowSeconds: 1_800_000_000,
  })
  assert.equal(req.url, b.sub.endpoint)
  const h = req.init.headers
  assert.equal(h["content-encoding"], "aes128gcm")
  assert.equal(h["content-type"], "application/octet-stream")
  assert.equal(h.ttl, "60")
  assert.equal(h.urgency, "high")
  assert.equal(h.topic, "pedido-1")
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.authorization)
  assert.ok(m)
  assert.equal(m[2], vapidKeys.publicKey)
  assert.equal(verifyVapidJwt(m[1], vapid.publicKey), true)
  assert.deepEqual(jwtClaims(m[1]), { aud: "https://fcm.googleapis.com", exp: 1_800_000_000 + 12 * 3600, sub: env.VAPID_SUBJECT })
  const plain = decryptPayload({ body: req.init.body, uaPrivateKey: b.privateKey, authSecret: b.auth })
  assert.deepEqual(plain, plaintext)
})

// ── delivery ────────────────────────────────────────────────────────────────

type Call = { url: string; init: RequestInit }

function fakeDeps(statusFor: (url: string) => number | Error) {
  const calls: Call[] = []
  const removed: string[][] = []
  const recorded: { ok: string[]; failed: string[] }[] = []
  const logs: { msg: string; detail?: Record<string, unknown> }[] = []
  const deps: DeliverDeps = {
    fetch: async (url, init) => {
      calls.push({ url, init })
      const s = statusFor(url)
      if (s instanceof Error) throw s
      return new Response(null, { status: s })
    },
    vapid: vapid as VapidConfig,
    nowSeconds: () => 1_800_000_000,
    remove: async (ids) => {
      removed.push(ids)
    },
    record: async (o) => {
      recorded.push(o)
    },
    log: (msg, detail) => logs.push({ msg, detail }),
  }
  return { deps, calls, removed, recorded, logs }
}

const opts = sendOptionsSchema.parse(undefined)
const plain = wirePayload(pushPayloadSchema.parse({ title: "Aviso" }))

test("deliver: 201 sent; 404 and 410 delete the subscription; 429/500/network keep it", async () => {
  const subs: StoredSubscription[] = [
    { id: "a", ...browser("https://fcm.googleapis.com/fcm/send/ok").sub },
    { id: "b", ...browser("https://fcm.googleapis.com/fcm/send/gone410").sub },
    { id: "c", ...browser("https://updates.push.services.mozilla.com/wpush/v2/gone404").sub },
    { id: "d", ...browser("https://fcm.googleapis.com/fcm/send/busy429").sub },
    { id: "e", ...browser("https://fcm.googleapis.com/fcm/send/down500").sub },
    { id: "f", ...browser("https://fcm.googleapis.com/fcm/send/neterr").sub },
  ]
  const f = fakeDeps((url) => {
    if (url.endsWith("gone410")) return 410
    if (url.endsWith("gone404")) return 404
    if (url.endsWith("busy429")) return 429
    if (url.endsWith("down500")) return 500
    if (url.endsWith("neterr")) return new TypeError("fetch failed")
    return 201
  })
  const r = await deliver(subs, plain, opts, f.deps)
  assert.deepEqual(r, { sent: 1, removed: 2, failed: 3 })
  assert.deepEqual(f.removed, [["b", "c"]])
  assert.deepEqual(f.recorded, [{ ok: ["a"], failed: ["d", "e", "f"] }])
  assert.equal(f.calls.length, 6)
  for (const c of f.calls) assert.equal(c.init.redirect, "error")
})

test("deliver: logs never carry the endpoint path, keys or payload", async () => {
  const b = browser("https://fcm.googleapis.com/fcm/send/SECRET-TOKEN")
  const f = fakeDeps(() => 500)
  await deliver([{ id: "x", ...b.sub }], plain, opts, f.deps)
  const text = JSON.stringify(f.logs)
  assert.ok(f.logs.length > 0)
  assert.ok(!text.includes("SECRET-TOKEN"))
  assert.ok(!text.includes(b.sub.p256dh) && !text.includes(b.sub.auth))
  assert.ok(!text.includes("Aviso"))
  assert.ok(text.includes("fcm.googleapis.com"))
})

test("deliver: a stored endpoint outside the allowlist is never fetched", async () => {
  const f = fakeDeps(() => 201)
  const r = await deliver(
    [{ id: "x", ...browser("https://169.254.169.254/latest/meta-data").sub }],
    plain,
    opts,
    f.deps
  )
  assert.deepEqual(r, { sent: 0, removed: 0, failed: 1 })
  assert.equal(f.calls.length, 0)
})

test("deliver: if deleting gone rows fails they count as failed, not removed", async () => {
  const f = fakeDeps(() => 410)
  f.deps.remove = async () => {
    throw new Error("db down")
  }
  const r = await deliver([{ id: "x", ...browser().sub }], plain, opts, f.deps)
  assert.deepEqual(r, { sent: 0, removed: 0, failed: 1 })
})

test("deliver: nothing to do with no subscriptions", async () => {
  const f = fakeDeps(() => 201)
  assert.deepEqual(await deliver([], plain, opts, f.deps), { sent: 0, removed: 0, failed: 0 })
  assert.equal(f.calls.length, 0)
})

// ── subscription + handlers ─────────────────────────────────────────────────

test("validateSubscription: real-looking subscription ok; junk keys and foreign hosts rejected", () => {
  const b = browser()
  const body = { endpoint: b.sub.endpoint, expirationTime: null, keys: { p256dh: b.sub.p256dh, auth: b.sub.auth } }
  assert.deepEqual(validateSubscription(body), { ok: true, value: b.sub })
  assert.deepEqual(validateSubscription({ ...body, endpoint: "https://evil.example/x" }), {
    ok: false,
    error: "endpoint_not_allowed",
  })
  const offCurve = b64urlEncode(Uint8Array.of(4, ...new Uint8Array(64).fill(1)))
  assert.deepEqual(validateSubscription({ ...body, keys: { ...body.keys, p256dh: offCurve } }), {
    ok: false,
    error: "bad_request",
  })
  assert.deepEqual(validateSubscription({ ...body, keys: { ...body.keys, auth: "AAAA" } }), {
    ok: false,
    error: "bad_request",
  })
  assert.deepEqual(validateSubscription({ endpoint: b.sub.endpoint }), { ok: false, error: "bad_request" })
})

function subscribeDeps(over: Partial<SubscribeDeps> = {}) {
  const saved: { userId: string; endpoint: string }[] = []
  const deps: SubscribeDeps = {
    userId: async () => "user-1",
    canSubscribe: async () => true,
    configured: () => true,
    save: async (userId, sub) => {
      saved.push({ userId, endpoint: sub.endpoint })
    },
    removeOwn: async () => 1,
    ...over,
  }
  return { deps, saved }
}

const jsonReq = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://app.ejemplo.cl/api/push/subscribe", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

test("subscribe: session, same-origin JSON, permission, config, validation", async () => {
  const b = browser()
  const body = { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.p256dh, auth: b.sub.auth } }

  let s = subscribeDeps({ userId: async () => null })
  assert.equal((await handleSubscribe(jsonReq("POST", body), s.deps)).status, 401)

  s = subscribeDeps({ canSubscribe: async () => false })
  assert.equal((await handleSubscribe(jsonReq("POST", body), s.deps)).status, 403)

  s = subscribeDeps()
  assert.equal(
    (await handleSubscribe(jsonReq("POST", body, { origin: "https://evil.example" }), s.deps)).status,
    400
  )
  const formReq = new Request("https://app.ejemplo.cl/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(body),
  })
  assert.equal((await handleSubscribe(formReq, s.deps)).status, 400)

  s = subscribeDeps({ configured: () => false })
  assert.equal((await handleSubscribe(jsonReq("POST", body), s.deps)).status, 503)

  s = subscribeDeps()
  assert.equal((await handleSubscribe(jsonReq("POST", "{not json"), s.deps)).status, 400)
  assert.equal((await handleSubscribe(jsonReq("POST", { ...body, endpoint: "https://evil.example/x" }), s.deps)).status, 422)
  assert.equal(s.saved.length, 0)

  const ok = await handleSubscribe(jsonReq("POST", body, { origin: "https://app.ejemplo.cl" }), s.deps)
  assert.equal(ok.status, 201)
  assert.deepEqual(s.saved, [{ userId: "user-1", endpoint: b.sub.endpoint }])
})

test("unsubscribe: deletes only the caller's row (removeOwn gets the session user)", async () => {
  const calls: [string, string][] = []
  const s = subscribeDeps({
    removeOwn: async (u, e) => {
      calls.push([u, e])
      return 1
    },
  })
  const res = await handleUnsubscribe(jsonReq("DELETE", { endpoint: "https://fcm.googleapis.com/fcm/send/x", userId: "otro" }), s.deps)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { removed: 1 })
  assert.deepEqual(calls, [["user-1", "https://fcm.googleapis.com/fcm/send/x"]])
  assert.equal((await handleUnsubscribe(jsonReq("DELETE", {}), s.deps)).status, 400)
})

test("service worker route: JavaScript, no-cache, handles push and clicks same-origin only", async () => {
  const res = handleServiceWorker()
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /javascript/)
  assert.equal(res.headers.get("cache-control"), "no-cache")
  const js = await res.text()
  for (const ev of ["push", "notificationclick", "pushsubscriptionchange"]) assert.ok(js.includes(`"${ev}"`), ev)
  assert.ok(js.includes("target.origin !== self.location.origin"))
  assert.ok(js.includes("/api/push/subscribe"))
})

// ── guards, read from the source ────────────────────────────────────────────

test("page and action check session and permission before touching data", () => {
  const page = src("ui/page.tsx")
  assert.ok(page.indexOf("requireOnboardedUser") < page.indexOf("canSubscribe()"))
  assert.ok(page.indexOf("forbidden()") < page.indexOf("countForUser("))
  const action = src("server/actions.ts")
  assert.ok(action.startsWith('"use server"'))
  assert.ok(action.indexOf("requireOnboardedUser") < action.indexOf("canSubscribe()"))
  assert.ok(action.indexOf("canSubscribe()") < action.indexOf("sendPush("))
  assert.match(action, /sendPush\(\s*session\.user\.id/)
  const route = src("server/subscribe/route.ts")
  assert.ok(route.includes("subscribeDeps()"))
})

test("store: every per-user query is scoped by user_id", () => {
  const store = src("server/store.ts")
  for (const fn of ["deleteOwnSubscription", "listForUser", "countForUser"]) {
    const body = store.slice(store.indexOf(`function ${fn}`), store.indexOf("\n}\n", store.indexOf(`function ${fn}`)))
    assert.match(body, /\.where\("user_id", "=", userId\)/, fn)
  }
})
