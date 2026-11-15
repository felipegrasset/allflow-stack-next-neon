/**
 * notifications-email v0.1 — what runs WITHOUT a database: signed links, the
 * email body, the send decision (with fakes), the catalog, permissions, the
 * manifest and, reading the code, the guards. Relative imports only.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { buildMail, safeSubject } from "../contracts/mail"
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "../contracts/token"
import { deliverEmail, type DeliverDeps } from "../server/deliver"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(process.cwd(), "modules", "notifications-email")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")
const SECRET = "secreto-de-prueba"

test("token: round trip, tampering and wrong secret are rejected", () => {
  const t = signUnsubscribeToken("user-1", SECRET)
  assert.equal(verifyUnsubscribeToken(t, SECRET), "user-1")
  assert.equal(verifyUnsubscribeToken(t, "otro"), null)
  assert.equal(verifyUnsubscribeToken(t, undefined), null)
  const [, sig] = t.split(".")
  const forged = `${Buffer.from("user-2").toString("base64url")}.${sig}`
  assert.equal(verifyUnsubscribeToken(forged, SECRET), null)
  for (const bad of [null, 5, "", "abc", "a.b.c", ".x", "x.", "x".repeat(700)])
    assert.equal(verifyUnsubscribeToken(bad, SECRET), null, String(bad))
  assert.throws(() => signUnsubscribeToken("", SECRET))
})

test("unsubscribeUrl: absolute link with a token that verifies", () => {
  const u = new URL(unsubscribeUrl("https://app.ejemplo.cl", "user-9", SECRET))
  assert.equal(u.origin + u.pathname, "https://app.ejemplo.cl/notifications/unsubscribe")
  assert.equal(verifyUnsubscribeToken(u.searchParams.get("token"), SECRET), "user-9")
})

test("buildMail: link, footer, unsubscribe and HTML escaping", () => {
  const m = buildMail({
    to: "a@ejemplo.cl",
    title: "Hola <b>mundo</b>\nX-Evil: 1",
    body: "Texto & más",
    href: "/tickets/1",
    baseUrl: "https://app.ejemplo.cl",
    unsubscribeUrl: "https://app.ejemplo.cl/notifications/unsubscribe?token=t",
    copy: es["notifications-email"].email,
  })
  assert.doesNotMatch(m.subject, /[\r\n]/)
  assert.match(m.text, /https:\/\/app\.ejemplo\.cl\/tickets\/1/)
  assert.match(m.text, /unsubscribe\?token=t/)
  assert.match(m.html, /&lt;b&gt;/)
  assert.doesNotMatch(m.html, /<b>mundo/)
  assert.match(m.html, /Texto &amp; más/)
  assert.equal(safeSubject("x".repeat(400)).length, 150)
  const none = buildMail({ to: "a@b.cl", title: "t", baseUrl: "https://x.cl", unsubscribeUrl: "https://x.cl/u", copy: en["notifications-email"].email })
  assert.doesNotMatch(none.text, /Open in the app/)
})

function deps(over: Partial<DeliverDeps> & { sent?: unknown[] } = {}): DeliverDeps {
  const sent = over.sent ?? []
  return {
    getRecipient: async () => ({ email: "ana@ejemplo.cl", locale: "es", enabled: true }),
    send: async (m) => void sent.push(m),
    env: { resendApiKey: "re_x", secret: SECRET },
    baseUrl: "https://app.ejemplo.cl",
    ...over,
  }
}

test("deliverEmail: sends to who has it on, in their language, with a working unsubscribe link", async () => {
  const sent: { to: string; text: string }[] = []
  assert.equal(await deliverEmail(deps({ sent }), { userId: "u1", title: "Hola", href: "/x" }), "sent")
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, "ana@ejemplo.cl")
  assert.match(sent[0].text, /Dejar de recibir/)
  const link = sent[0].text.match(/token=([^\s]+)/)?.[1]
  assert.equal(verifyUnsubscribeToken(decodeURIComponent(link ?? ""), SECRET), "u1")
  const en1: { text: string }[] = []
  await deliverEmail(deps({ sent: en1, getRecipient: async () => ({ email: "a@b.cl", locale: "en", enabled: true }) }), { userId: "u1", title: "Hi" })
  assert.match(en1[0].text, /Stop receiving/)
})

test("deliverEmail: no email when off, without provider, without secret or without user", async () => {
  const sent: unknown[] = []
  const a = { userId: "u1", title: "t" }
  assert.equal(await deliverEmail(deps({ sent, getRecipient: async () => ({ email: "a@b.cl", locale: "es", enabled: false }) }), a), "disabled")
  assert.equal(await deliverEmail(deps({ sent, env: { secret: SECRET } }), a), "no_provider")
  assert.equal(await deliverEmail(deps({ sent, env: { resendApiKey: "k" } }), a), "no_secret")
  assert.equal(await deliverEmail(deps({ sent, getRecipient: async () => null }), a), "no_user")
  assert.equal(sent.length, 0)
})

test("deliverEmail: a failing send is reported, never thrown", async () => {
  let logged = 0
  const out = await deliverEmail(
    deps({ send: async () => { throw new Error("boom") }, log: () => void logged++ }),
    { userId: "u1", title: "t" }
  )
  assert.equal(out, "failed")
  assert.equal(logged, 1)
})

test("catalog: same keys in es and en", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  assert.deepEqual(Object.keys(es), ["notifications-email"])
})

test("permissions: own-preference permission, granted to member, not adminAccess", () => {
  assert.deepEqual(permissions.statement, { notificationEmail: ["manage"] })
  assert.deepEqual(permissions.grants.member, { notificationEmail: ["manage"] })
  assert.equal("adminAccess" in permissions, false)
})

test("manifest: table, migration, routes and dependency", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "notifications-email")
  assert.deepEqual(m.dependsOn, ["notifications"])
  assert.deepEqual(m.tables, ["notifications_email_prefs"])
  assert.deepEqual(m.migrations, ["0108_notifications_email_init"])
  assert.deepEqual(m.routes.map((r: { path: string }) => r.path), ["/settings/notifications", "/notifications/unsubscribe"])
  assert.match(read("db/migrations/0108_notifications_email_init.ts"), /user_id\s+text\s+primary key/)
})

test("the Server Action checks session + permission first and never takes the user id from the client", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(actions, ["saveEmailPreferenceAction"])
  assert.ok(src.indexOf("actionSession(") < src.indexOf("safeParse("))
  assert.ok(src.indexOf("safeParse(") < src.indexOf("setEnabledWith(getKysely()"))
  assert.match(src, /session\.user\.id/)
})

test("store: Kysely only; the unsubscribe route only turns emails off", () => {
  assert.doesNotMatch(read("server/store.ts"), /sql`/)
  assert.match(read("server/store.ts"), /onConflict\(/)
  const route = read("server/unsubscribe/route.ts")
  assert.match(route, /setEnabledWith\(getKysely\(\), userId, false\)/)
  assert.ok(route.indexOf("verifyUnsubscribeToken(") < route.indexOf("setEnabledWith("))
})
