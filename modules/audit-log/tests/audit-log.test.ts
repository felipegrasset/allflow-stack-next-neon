/**
 * audit-log v0.1 — what runs without a database: redaction and diffs, the
 * input schema, URL filters and cursors, the recorder (with a fake Kysely), the
 * `audited` wrapper, the catalog and, reading the code, the guards and the
 * insert-only guarantee. Relative imports only, so it runs transpiled.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { REDACTED, buildDiff, isSensitiveKey, normalizeGivenDiff, parseDiff, redact } from "../contracts/diff"
import { AuditError } from "../contracts/errors"
import { auditEntrySchema } from "../contracts/input"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { decodeCursor, encodeCursor, likePattern, parseDay, parseFilters } from "../server/filters"
import { recordAuditWith, resolveActor } from "../server/store"
import { createAudited } from "../server/wrap"

const DIR = join(process.cwd(), "modules", "audit-log")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (e: unknown) => e instanceof AuditError && e.code === code)
}

/** A fake Kysely that captures what insertInto("audit_log").values(...) receives. */
function fakeDb() {
  const rows: Record<string, unknown>[] = []
  const db = {
    insertInto(table: string) {
      assert.equal(table, "audit_log")
      return {
        values(v: Record<string, unknown>) {
          return { execute: async () => void rows.push(v) }
        },
      }
    },
  }
  return { db: db as never, rows }
}

test("isSensitiveKey: built-in names, any spelling, no false positives on short words", () => {
  for (const k of ["password", "newPassword", "access_token", "refreshToken", "API-Key", "client_secret", "Authorization", "cookie", "card_number", "pin", "otp", "cvv"])
    assert.equal(isSensitiveKey(k), true, k)
  for (const k of ["name", "email", "shipping", "pinned", "stage", "amount", "description"])
    assert.equal(isSensitiveKey(k), false, k)
  assert.equal(isSensitiveKey("rut", ["rut"]), true)
  assert.equal(isSensitiveKey("rut"), false)
})

test("redact: nested keys, arrays, dates and bigint; no secret survives", () => {
  const out = redact({
    user: { name: "Ana", password: "hunter2", profile: { apiKey: "sk-1", list: [{ token: "t" }, BigInt(1)] } },
    at: new Date("2026-01-02T03:04:05Z"),
  }) as { user: { password: unknown; profile: { apiKey: unknown; list: [{ token: unknown }, unknown] } }; at: unknown }
  const json = JSON.stringify(out)
  assert.ok(!json.includes("hunter2") && !json.includes("sk-1") && !json.includes('"t"'))
  assert.equal(out.user.password, REDACTED)
  assert.equal(out.user.profile.apiKey, REDACTED)
  assert.equal(out.user.profile.list[0].token, REDACTED)
  assert.equal(out.user.profile.list[1], "1")
  assert.equal(out.at, "2026-01-02T03:04:05.000Z")
})

test("redact: circular, deep and long values are bounded", () => {
  const a: Record<string, unknown> = { name: "x" }
  a.self = a
  assert.equal((redact(a) as { self: unknown }).self, "[circular]")
  assert.ok(JSON.stringify(redact("z".repeat(5000))).length < 700)
  let deep: unknown = "end"
  for (let i = 0; i < 20; i++) deep = { n: deep }
  assert.match(JSON.stringify(redact(deep)), /max-depth/)
})

test("buildDiff: update keeps only changed fields", () => {
  const d = buildDiff({ name: "Ana", stage: "new", amount: 10 }, { name: "Ana", stage: "won", amount: 10, note: "ok" })
  assert.deepEqual(d, { stage: { from: "new", to: "won" }, note: { to: "ok" } })
})

test("buildDiff: creation has only `to`, deletion only `from`, field removal only `from`", () => {
  assert.deepEqual(buildDiff(undefined, { a: 1 }), { a: { to: 1 } })
  assert.deepEqual(buildDiff({ a: 1 }, undefined), { a: { from: 1 } })
  assert.deepEqual(buildDiff({ a: 1, b: 2 }, { a: 1 }), { b: { from: 2 } })
  assert.deepEqual(buildDiff(undefined, undefined), {})
})

test("buildDiff: a changed password shows as changed but its value is never kept", () => {
  const d = buildDiff({ email: "a@x.example", password: "old-pass" }, { email: "a@x.example", password: "new-pass" })
  assert.deepEqual(d, { password: { from: REDACTED, to: REDACTED } })
  assert.ok(!JSON.stringify(d).includes("pass-"))
  // unchanged secret: no entry at all
  assert.deepEqual(buildDiff({ token: "same" }, { token: "same" }), {})
  // custom field names
  assert.deepEqual(buildDiff({ rut: "1-9" }, { rut: "2-7" }, ["rut"]), { rut: { from: REDACTED, to: REDACTED } })
})

test("buildDiff: deep-equal values and dates compare equal; oversized diffs collapse", () => {
  assert.deepEqual(buildDiff({ o: { b: 1, a: 2 }, d: new Date(5) }, { o: { a: 2, b: 1 }, d: new Date(5) }), {})
  const big: Record<string, string> = {}
  for (let i = 0; i < 400; i++) big[`f${i}`] = "x".repeat(400)
  const d = buildDiff(undefined, big)
  assert.deepEqual(Object.keys(d), ["_truncated"])
})

test("normalizeGivenDiff redacts a caller-built diff too", () => {
  const d = normalizeGivenDiff({ password: { from: "a", to: "b" }, stage: { from: "x", to: "y" }, note: "hola", secretNote: "s" })
  assert.deepEqual(d.password, { to: REDACTED })
  assert.deepEqual(d.stage, { from: "x", to: "y" })
  assert.deepEqual(d.note, { to: "hola" })
  assert.deepEqual(d.secretNote, { to: REDACTED })
})

test("parseDiff reads stored diffs and tolerates garbage", () => {
  assert.deepEqual(parseDiff({ a: { from: 1, to: 2 }, b: { to: 3 } }).map((r) => [r.field, r.hasFrom, r.hasTo]), [["a", true, true], ["b", false, true]])
  assert.deepEqual(parseDiff('{"a":{"to":1}}').length, 1)
  for (const bad of [null, "nope", 5, [], undefined]) assert.deepEqual(parseDiff(bad), [])
})

test("entry schema: action/entity are keys, entityId required, actor shape", () => {
  const ok = { action: "contact.update", entity: "contact", entityId: "c-1" }
  assert.equal(auditEntrySchema.safeParse(ok).success, true)
  assert.equal(auditEntrySchema.safeParse({ ...ok, actor: "system" }).success, true)
  assert.equal(auditEntrySchema.safeParse({ ...ok, actor: { id: "u1", name: "Ana" } }).success, true)
  for (const bad of [{ ...ok, action: "Contact Update" }, { ...ok, entity: "" }, { ...ok, entityId: " " }, { ...ok, actor: "root" }, { ...ok, sensitive: [""] }])
    assert.equal(auditEntrySchema.safeParse(bad).success, false)
})

test("resolveActor: explicit wins, system is null, none without session fails", () => {
  const session = { id: "u1", name: "Ana" }
  assert.deepEqual(resolveActor(undefined, session), session)
  assert.deepEqual(resolveActor("system", session), { id: null, name: null })
  assert.deepEqual(resolveActor({ id: "job", name: "Cron" }, session), { id: "job", name: "Cron" })
  expectCode(() => resolveActor(undefined, null), "unauthenticated")
})

test("recordAuditWith: inserts one redacted row with the session actor", async () => {
  const { db, rows } = fakeDb()
  const r = await recordAuditWith(
    db,
    { action: "user.update", entity: "user", entityId: "u-7", before: { role: "member", password: "a" }, after: { role: "admin", password: "b" } },
    { id: "u-1", name: "Camila Soto" }
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, r.id)
  assert.equal(rows[0].actor_id, "u-1")
  assert.equal(rows[0].actor_name, "Camila Soto")
  assert.equal(rows[0].action, "user.update")
  const stored = JSON.parse(rows[0].diff as string)
  assert.deepEqual(stored, { role: { from: "member", to: "admin" }, password: { from: REDACTED, to: REDACTED } })
})

test("recordAuditWith: invalid input and missing actor are errors, nothing is inserted", async () => {
  const { db, rows } = fakeDb()
  await assert.rejects(recordAuditWith(db, { action: "BAD ACTION", entity: "x", entityId: "1" }, { id: "u", name: null }), (e: unknown) => e instanceof AuditError && e.code === "invalid_input")
  await assert.rejects(recordAuditWith(db, { action: "a.b", entity: "x", entityId: "1" }, null), (e: unknown) => e instanceof AuditError && e.code === "unauthenticated")
  assert.equal(rows.length, 0)
  // system actor needs no session
  await recordAuditWith(db, { action: "job.run", entity: "job", entityId: "1", actor: "system", diff: { token: "abc" } }, null)
  assert.equal(rows[0].actor_id, null)
  assert.ok(!(rows[0].diff as string).includes("abc"))
})

test("audited: records after success with before/after and the entity id from the result", async () => {
  const calls: Record<string, unknown>[] = []
  const audited = createAudited(async (e) => void calls.push(e))
  const fn = audited(
    { action: "deal.update", entity: "deal", entityId: ([id], r) => `${id}:${r.v}`, before: () => ({ stage: "new" }), after: (_a, r) => ({ stage: r.stage }) },
    async (id: string) => ({ v: 2, stage: "won", id })
  )
  assert.deepEqual(await fn("d1"), { v: 2, stage: "won", id: "d1" })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].entityId, "d1:2")
  assert.deepEqual(calls[0].before, { stage: "new" })
  assert.deepEqual(calls[0].after, { stage: "won" })
})

test("audited: a failing action records nothing; a failing record is logged unless strict", async () => {
  let n = 0
  const ok = createAudited(async () => void n++)
  const boom = ok({ action: "a.b", entity: "x", entityId: () => "1" }, async () => {
    throw new Error("nope")
  })
  await assert.rejects(boom(), /nope/)
  assert.equal(n, 0)

  const bad = createAudited(async () => {
    throw new Error("db down")
  })
  const spec = { action: "a.b", entity: "x", entityId: () => "1" }
  const origError = console.error
  console.error = () => {}
  try {
    assert.equal(await bad(spec, async () => "done")(), "done")
    await assert.rejects(bad({ ...spec, strict: true }, async () => "done")(), /db down/)
  } finally {
    console.error = origError
  }
})

test("filters: parse, reject junk, end date is exclusive, cursor round-trips", () => {
  const { filters, invalid } = parseFilters({ entity: "contact", action: "contact.", actor: "ana", from: "2026-11-01", to: "2026-11-05" })
  assert.equal(invalid, false)
  assert.equal(filters.entity, "contact")
  assert.equal(filters.from?.toISOString(), "2026-11-01T00:00:00.000Z")
  assert.equal(filters.to?.toISOString(), "2026-11-06T00:00:00.000Z")
  const bad = parseFilters({ entity: "x; drop table", from: "2026-02-30", cursor: "nope", action: ["a.b", "c"] })
  assert.equal(bad.invalid, true)
  assert.equal(bad.filters.entity, undefined)
  assert.equal(bad.filters.from, undefined)
  assert.equal(bad.filters.action, "a.b")
  assert.equal(parseDay("2026-13-01"), null)
  const c = { at: "2026-11-05 10:00:00.123456+00", id: "abc-123" }
  assert.deepEqual(decodeCursor(encodeCursor(c)), c)
  assert.equal(decodeCursor("2026'; drop~x"), null)
  assert.equal(likePattern("50%_a\\b"), "50\\%\\_a\\\\b")
})

test("catalog: same keys in es and en, same ICU arguments", () => {
  const flat = (o: object, p = ""): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)))
  const e = new Map(flat(en)), s = new Map(flat(es))
  assert.deepEqual([...e.keys()].sort(), [...s.keys()].sort())
  for (const [k, v] of s) assert.equal(v.includes("{n"), e.get(k)!.includes("{n"), k)
  assert.ok("audit-log" in es && Object.keys(es).length === 1)
})

test("permissions: audit:read only, no member grant", () => {
  assert.deepEqual(permissions.statement, { audit: ["read"] })
  assert.equal("grants" in permissions, false)
})

test("source: the page guards, the module only inserts, the table is protected by a trigger", () => {
  assert.match(read("ui/page.tsx"), /await requireAuditReader\(/)
  assert.match(read("server/guard.ts"), /audit: \["read"\]/)
  for (const f of ["server/store.ts", "server/api.ts", "server/queries.ts", "server/wrap.ts", "seed.ts"]) {
    const src = read(f)
    assert.doesNotMatch(src, /updateTable|deleteFrom|sql`\s*(update|delete)/i, f)
  }
  assert.match(read("server/store.ts"), /insertInto\("audit_log"\)/)
  assert.doesNotMatch(read("server/store.ts"), /sql`/)
  const mig = read("db/migrations/0109_audit_log_init.ts")
  assert.match(mig, /before update or delete on audit_log/)
  assert.match(mig, /raise exception/)
})
