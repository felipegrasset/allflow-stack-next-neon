/**
 * events v0.1 — runs without network or database: body shape, property
 * allow-list, personal-data filter, no-op without a key, failure handling,
 * timeout. Relative imports only (runs transpiled, no `@/` alias).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  MAX_PAYLOAD_CHARS,
  buildEventBody,
  isValidEventName,
  sanitizeProps,
  sendEvent,
  type TrackDeps,
} from "../server/track"

const ENV = { ALLFLOW_INGEST_URL: "https://ingest.example.test/api/v1/", ALLFLOW_INGEST_KEY: "afk_test_123" }

type Call = { url: string; init: RequestInit }
function fakeFetch(status = 201, json: unknown = { ok: true, outcome: "created" }) {
  const calls: Call[] = []
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(json), { status })
  }) as typeof fetch
  return { f, calls }
}
const deps = (f: typeof fetch, over: Partial<TrackDeps> = {}): TrackDeps => ({ fetch: f, env: ENV, ...over })

test("event names: lower case, letter first, up to 60", () => {
  assert.equal(isValidEventName("order_paid"), true)
  assert.equal(isValidEventName("signup.completed"), true)
  assert.equal(isValidEventName("Order"), false)
  assert.equal(isValidEventName("1abc"), false)
  assert.equal(isValidEventName(""), false)
  assert.equal(isValidEventName("a".repeat(61)), false)
  assert.equal(isValidEventName(42), false)
})

test("sanitizeProps keeps allow-listed primitives and drops the rest", () => {
  const { payload, dropped } = sanitizeProps({
    plan: "pro",
    amount: 19900,
    count: NaN,
    status: null,
    result: true,
    secret_field: "x",
    channel: { nested: 1 },
    value: [1, 2],
    reason: undefined,
  })
  assert.deepEqual(payload, { plan: "pro", amount: 19900, status: null, result: true })
  assert.deepEqual(dropped.sort(), ["channel", "count", "secret_field", "value"])
})

test("sanitizeProps: personal keys and values are dropped by default", () => {
  const props = { plan: "pro", source: "ana@example.test", step: "llamar +56 9 1234 5678", path: "/checkout" }
  const base = sanitizeProps(props)
  assert.deepEqual(base.payload, { plan: "pro", path: "/checkout" })
  assert.deepEqual(base.dropped.sort(), ["source", "step"])
  // An allow-listed key that names personal data still needs the explicit opt-in.
  assert.deepEqual(sanitizeProps({ email: "a@b.cl" }, { allow: ["email"] }).payload, {})
  assert.deepEqual(sanitizeProps({ email: "a@b.cl" }, { allow: ["email"], allowPersonal: true }).payload, {
    email: "a@b.cl",
  })
  // "ip" must not catch ordinary words.
  assert.deepEqual(sanitizeProps({ plan: "ship", status: "zip" }).payload, { plan: "ship", status: "zip" })
})

test("sanitizeProps trims, cuts long strings and caps the key count", () => {
  assert.equal(sanitizeProps({ plan: "  pro  " }).payload.plan, "pro")
  assert.equal((sanitizeProps({ plan: "x".repeat(500) }).payload.plan as string).length, 200)
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]))
  const allow = Object.keys(many)
  assert.equal(Object.keys(sanitizeProps(many, { allow }).payload).length, 20)
})

test("buildEventBody builds exactly the ingest shape", () => {
  const r = buildEventBody("order_paid", { amount: 1 }, { userId: "u1" }, { idempotencyKey: "order-9" })
  assert.ok(r.ok)
  assert.deepEqual(r.body, {
    kind: "order_paid",
    external_user_id: "u1",
    payload: { amount: 1 },
    idempotency_key: "order-9",
    source: "app",
  })
  for (const forbidden of ["org_id", "project_id", "stage", "contact_id"]) assert.equal(forbidden in r.body, false)
})

test("buildEventBody: identity is required; email only when given and valid", () => {
  assert.deepEqual(buildEventBody("x", {}, {}), { ok: false, reason: "no_identity" })
  assert.deepEqual(buildEventBody("x", {}, { email: "not-an-email" }), { ok: false, reason: "no_identity" })
  const r = buildEventBody("x", {}, { userId: " u1 ", email: " Ana@Example.test " })
  assert.ok(r.ok)
  assert.equal(r.body.email, "ana@example.test")
  assert.equal(r.body.external_user_id, "u1")
  assert.equal("payload" in r.body, false)
  assert.deepEqual(buildEventBody("Bad Name", {}, { userId: "u" }), { ok: false, reason: "invalid_name" })
})

test("buildEventBody keeps the payload under the ingest cap", () => {
  const keys = Array.from({ length: 20 }, (_, i) => `k${i}`)
  // Control characters escape to 6 chars each in JSON: 20 * 200 * 6 overshoots 8 KB.
  const props = Object.fromEntries(keys.map((k) => [k, "\u0001".repeat(200)]))
  // Control chars are trimmed away by trim()? \u0001 is not whitespace, so they stay.
  const r = buildEventBody("x", props, { userId: "u" }, { allow: keys })
  assert.deepEqual(r, { ok: false, reason: "too_large" })
  assert.ok(MAX_PAYLOAD_CHARS === 8192)
})

test("sendEvent posts to <base>/events with the bearer key", async () => {
  const { f, calls } = fakeFetch()
  const r = await sendEvent("signed_up", { plan: "vibe" }, { userId: "u1" }, {}, deps(f))
  assert.deepEqual(r, { ok: true, outcome: "created" })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, "https://ingest.example.test/api/v1/events")
  const headers = calls[0]!.init.headers as Record<string, string>
  assert.equal(headers.Authorization, "Bearer afk_test_123")
  assert.equal(calls[0]!.init.method, "POST")
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    kind: "signed_up",
    external_user_id: "u1",
    payload: { plan: "vibe" },
    source: "app",
  })
})

test("sendEvent reports a duplicate as delivered", async () => {
  const { f } = fakeFetch(200, { ok: true, outcome: "duplicate" })
  assert.deepEqual(await sendEvent("x", {}, { userId: "u" }, {}, deps(f)), { ok: true, outcome: "duplicate" })
})

test("sendEvent is a no-op without key or URL", async () => {
  for (const env of [{}, { ALLFLOW_INGEST_URL: ENV.ALLFLOW_INGEST_URL }, { ALLFLOW_INGEST_KEY: "k" }, { ALLFLOW_INGEST_URL: " ", ALLFLOW_INGEST_KEY: " " }]) {
    const { f, calls } = fakeFetch()
    assert.deepEqual(await sendEvent("x", {}, { userId: "u" }, {}, { fetch: f, env }), { ok: false, reason: "disabled" })
    assert.equal(calls.length, 0)
  }
})

test("sendEvent sends nothing for an invalid name or without identity", async () => {
  const { f, calls } = fakeFetch()
  assert.deepEqual(await sendEvent("Bad", {}, { userId: "u" }, {}, deps(f)), { ok: false, reason: "invalid_name" })
  assert.deepEqual(await sendEvent("ok", {}, {}, {}, deps(f)), { ok: false, reason: "no_identity" })
  assert.equal(calls.length, 0)
})

test("sendEvent never throws: HTTP errors and network errors", async () => {
  const logs: string[] = []
  const log = (m: string) => logs.push(m)
  const r401 = await sendEvent("x", {}, { userId: "u" }, {}, deps(fakeFetch(401, { error: "Unauthorized." }).f, { log }))
  assert.deepEqual(r401, { ok: false, reason: "rejected" })
  const boom = (async () => {
    throw new Error("ECONNRESET")
  }) as typeof fetch
  assert.deepEqual(await sendEvent("x", {}, { userId: "u" }, {}, deps(boom, { log })), { ok: false, reason: "error" })
  assert.equal(logs.length, 2)
  assert.ok(logs.every((m) => !m.includes("afk_test_123")))
})

test("sendEvent gives up after the timeout", async () => {
  const hang = ((_url: unknown, init?: RequestInit) =>
    new Promise((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))
    })) as typeof fetch
  const t0 = Date.now()
  const r = await sendEvent("x", {}, { userId: "u" }, {}, deps(hang, { timeoutMs: 30 }))
  assert.deepEqual(r, { ok: false, reason: "error" })
  assert.ok(Date.now() - t0 < 1500)
})

test("the manifest declares the ingest env and no tables", () => {
  const m = JSON.parse(readFileSync(join(process.cwd(), "modules", "events", "manifest.json"), "utf8"))
  assert.equal(m.id, "events")
  assert.deepEqual(m.env.map((e: { key: string }) => e.key), ["ALLFLOW_INGEST_URL", "ALLFLOW_INGEST_KEY"])
  assert.equal(m.tables, undefined)
})
