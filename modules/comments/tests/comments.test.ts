/**
 * comments v0.1 — what runs without a database: delete rules, mention
 * detection, the access grant (signature, expiry, tampering), safe links,
 * Zod schemas, the catalog, the manifest, permissions and, reading the code,
 * the guards of the Server Actions and of the component. Relative imports only,
 * so it runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { canDeleteComment, findMentions, isEntityKey, isSafeHref } from "../contracts/domain"
import { commentSchemas } from "../contracts/input"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { signGrant, verifyGrant, type Grant } from "../server/grant"

const DIR = join(process.cwd(), "modules", "comments")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

test("canDeleteComment: the author or a moderator, nobody else", () => {
  const c = { authorId: "u-a" }
  assert.equal(canDeleteComment(c, { userId: "u-a", canDelete: false }), true)
  assert.equal(canDeleteComment(c, { userId: "u-b", canDelete: false }), false)
  assert.equal(canDeleteComment(c, { userId: "u-b", canDelete: true }), true)
})

const people = [
  { id: "u-ana", name: "Ana" },
  { id: "u-anam", name: "Ana María" },
  { id: "u-luis", name: "Luis Soto" },
  { id: "u-me", name: "Yo Mismo" },
]

test("findMentions: @Name with boundaries, case-insensitive, never the author", () => {
  assert.deepEqual(findMentions("Hola @luis soto, mira esto", people, "u-me"), ["u-luis"])
  assert.deepEqual(findMentions("@Yo Mismo se habla solo", people, "u-me"), [])
  assert.deepEqual(findMentions("sin menciones, correo a@ana.cl", people, "u-me"), [])
  assert.deepEqual(findMentions("Luis Soto sin arroba", people, "u-me"), [])
})

test("findMentions: the longest name wins and a shorter one inside it is not mentioned too", () => {
  assert.deepEqual(findMentions("Gracias @Ana María!", people, "u-me"), ["u-anam"])
  assert.deepEqual(findMentions("@Ana y @Ana María", people, "u-me").sort(), ["u-ana", "u-anam"])
  // "@Anabel" is a different word than "@Ana"
  assert.deepEqual(findMentions("hola @Anabel", people, "u-me"), [])
})

test("findMentions: ambiguous names (two people, same name) mention nobody; no repeats; special chars are literal", () => {
  const dup = [
    { id: "u-1", name: "Carlos Díaz" },
    { id: "u-2", name: "carlos díaz" },
    { id: "u-3", name: "R.J. (Ops)" },
  ]
  assert.deepEqual(findMentions("@Carlos Díaz ven", dup, "x"), [])
  assert.deepEqual(findMentions("@R.J. (Ops) @R.J. (Ops)", dup, "x"), ["u-3"])
  assert.deepEqual(findMentions("@RxJx (Ops)", dup, "x"), [])
})

test("isSafeHref and isEntityKey", () => {
  assert.equal(isSafeHref("/orders/12?tab=1#c"), true)
  for (const bad of ["//evil.com", "https://evil.com", "orders", "/a\\b", "/a\nb", "", "/" + "a".repeat(600)])
    assert.equal(isSafeHref(bad), false, JSON.stringify(bad).slice(0, 30))
  assert.equal(isEntityKey("order"), true)
  assert.equal(isEntityKey("Order"), false)
  assert.equal(isEntityKey("a b"), false)
})

const SECRET = "test-secret-not-real"
const NOW = 1_800_000_000_000
const grant: Grant = { u: "u-1", e: "order", i: "o-1", h: "/orders/o-1", m: ["u-2"], x: NOW + 1000 }

test("grant: signs and verifies; no secret means no token", () => {
  const token = signGrant(grant, SECRET)!
  assert.deepEqual(verifyGrant(token, SECRET, NOW), grant)
  assert.equal(signGrant(grant, undefined), null)
  assert.equal(verifyGrant(token, undefined, NOW), null)
})

test("grant: expired, forged, other secret and malformed tokens are refused", () => {
  const token = signGrant(grant, SECRET)!
  assert.equal(verifyGrant(token, SECRET, NOW + 2000), null)
  assert.equal(verifyGrant(token, "another-secret", NOW), null)
  const [payload, sig] = token.split(".")
  const forged = Buffer.from(JSON.stringify({ ...grant, u: "u-admin" })).toString("base64url")
  assert.equal(verifyGrant(`${forged}.${sig}`, SECRET, NOW), null)
  assert.equal(verifyGrant(`${payload}.`, SECRET, NOW), null)
  assert.equal(verifyGrant(`${payload}.${sig}.x`, SECRET, NOW), null)
  assert.equal(verifyGrant("garbage", SECRET, NOW), null)
  assert.equal(verifyGrant(42, SECRET, NOW), null)
  assert.equal(verifyGrant("a".repeat(9000), SECRET, NOW), null)
})

test("schema: body required, trimmed, capped, localized messages", () => {
  const { addSchema } = commentSchemas({ required: "REQ", tooLong: "LONG" })
  const empty = addSchema.safeParse({ body: "   " })
  assert.equal(empty.success, false)
  if (!empty.success) assert.equal(empty.error.issues[0].message, "REQ")
  const long = addSchema.safeParse({ body: "a".repeat(2001) })
  assert.equal(long.success, false)
  if (!long.success) assert.equal(long.error.issues[0].message, "LONG")
  const ok = addSchema.safeParse({ body: "  hola  " })
  assert.equal(ok.success && ok.data.body, "hola")
})

test("messages: es and en have the same keys and the same ICU arguments", () => {
  const leaves = (o: unknown, p = ""): [string, string][] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "string" ? [[p + k, v] as [string, string]] : leaves(v, `${p}${k}.`)
    )
  const args = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join(",")
  const a = leaves(es)
  const b = new Map(leaves(en))
  assert.deepEqual(a.map(([k]) => k).sort(), [...b.keys()].sort())
  for (const [k, v] of a) {
    assert.ok(v.length > 0 && b.get(k)!.length > 0, k)
    assert.equal(args(v), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["comments"])
})

test("permissions: member creates, only moderators delete others'", () => {
  assert.deepEqual(permissions.statement, { comment: ["create", "delete"] })
  assert.deepEqual(permissions.grants.member, { comment: ["create"] })
})

test("manifest: table, migration and entrypoints match the files; no own route", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "comments")
  assert.deepEqual(m.dependsOn, ["notifications"])
  assert.deepEqual(m.migrations, ["0120_comments_init"])
  assert.deepEqual(m.routes, [])
  const sql = read("db/migrations/0120_comments_init.ts")
  for (const table of m.tables) assert.match(sql, new RegExp(`create table ${table} \\(`), table)
  for (const f of Object.values(m.entrypoints) as string[]) assert.doesNotThrow(() => read(f), f)
  assert.doesNotMatch(sql, /references "user"/)
})

test("every Server Action checks session, the grant and its owner before writing", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const parts = src.split(/export async function /).slice(1)
  assert.equal(parts.length, 2)
  for (const p of parts) {
    const guard = p.indexOf("actionSession(")
    const grantAt = p.indexOf("verifyGrant(")
    const write = p.search(/(insertComment|deleteCommentWith)\(/)
    assert.ok(guard > -1 && grantAt > guard && write > grantAt, p.slice(0, 40))
    assert.match(p, /grant\.u !== session\.user\.id/)
  }
  assert.match(parts[0], /actionSession\("\/", "create"\)/)
  assert.match(parts[0], /safeParse\(/)
})

test("source: mentions only reach people from the grant who exist; no email anywhere", () => {
  const actions = read("server/actions.ts")
  assert.match(actions, /existingPeople\(db, grant\.m\)/)
  for (const f of ["server/store.ts", "server/notify.ts", "server/actions.ts", "ui/comments.tsx", "ui/comment-form.tsx"])
    assert.doesNotMatch(read(f), /\.email|"email"|email:|u\.email/i, f)
  assert.doesNotMatch(read("server/store.ts"), /sql`/)
})

test("source: the component shows nothing without session and canAccess", () => {
  const src = read("ui/comments.tsx")
  assert.match(src, /typeof canAccess !== "function"/)
  assert.ok(src.indexOf("getSession()") < src.indexOf("allowed(canAccess, viewerId"))
  assert.ok(src.indexOf("allowed(canAccess, viewerId") < src.indexOf("listComments("))
  assert.match(src, /catch \{\s*return false/)
})

test("source: delete locks the row and re-applies canDeleteComment, scoped to the record", () => {
  const store = read("server/store.ts")
  assert.match(store, /\.forUpdate\(\)/)
  assert.match(store, /canDeleteComment\(/)
  assert.match(store, /\.where\("entity", "=", entity\)/)
})
