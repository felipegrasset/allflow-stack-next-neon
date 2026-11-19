/**
 * forms v0.1 — what runs without a database: the definition schema, answer
 * validation for the nine field types, aggregation, the public submission
 * rules (honeypot, closed, one per person), the examples, the catalog and,
 * reading the code, the guards of the actions. Relative imports only, so it
 * also runs transpiled without the `@/` alias (run from the repo root).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { validateAnswers, answerText, type Answers } from "../contracts/answers"
import { defineForm, formDefinitionSchema, isIsoDate, slugSchema, type FormDefinitionInput } from "../contracts/definition"
import { FormError } from "../contracts/errors"
import { summarize } from "../contracts/summary"
import { satisfactionDefinition, starterDefinition, workshopDefinition } from "../examples"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { planSubmission } from "../server/submission"

const L = (t: string) => ({ es: t, en: t })

const full: FormDefinitionInput = {
  title: L("Todo"),
  fields: [
    { id: "name", type: "text", label: L("n"), required: true, maxLength: 10 },
    { id: "bio", type: "textarea", label: L("b") },
    { id: "age", type: "number", label: L("a"), min: 0, max: 120, integer: true },
    { id: "color", type: "single", label: L("c"), options: [{ value: "red", label: L("r") }, { value: "blue", label: L("b") }] },
    { id: "tags", type: "multiple", label: L("t"), maxChoices: 2, options: [{ value: "a", label: L("a") }, { value: "b", label: L("b") }, { value: "c", label: L("c") }] },
    { id: "stars", type: "scale", label: L("s"), from: 1, to: 5 },
    { id: "when", type: "date", label: L("w"), min: "2026-01-01", max: "2026-12-31" },
    { id: "mail", type: "email", label: L("m") },
    { id: "ok", type: "consent", label: L("ok"), required: true },
  ],
}
const def = defineForm(full)
const good = { name: " Ana ", age: "30", color: "red", tags: ["c", "a"], stars: "4", when: "2026-06-30", mail: " ANA@Example.com ", ok: "on" }

function errorsOf(raw: Record<string, unknown>) {
  const r = validateAnswers(def, raw)
  assert.equal(r.ok, false)
  return r.ok ? {} : r.errors
}

test("the example definitions are valid", () => {
  for (const d of [starterDefinition(), satisfactionDefinition(), workshopDefinition()])
    assert.doesNotThrow(() => defineForm(d))
})

test("defineForm rejects broken definitions with invalid_definition", () => {
  const f = full.fields
  const broken: unknown[] = [
    { ...full, fields: [] },
    { ...full, fields: [f[0], f[0]] },
    { ...full, fields: [{ id: "Bad Id", type: "text", label: "x" }] },
    { ...full, fields: [{ id: "__proto__", type: "text", label: "x" }] },
    { ...full, fields: [{ id: "x", type: "wizard", label: "x" }] },
    { ...full, fields: [{ id: "x", type: "single", label: "x", options: [{ value: "a", label: "a" }] }] },
    { ...full, fields: [{ id: "x", type: "single", label: "x", options: [{ value: "a", label: "a" }, { value: "a", label: "b" }] }] },
    { ...full, fields: [{ id: "x", type: "multiple", label: "x", maxChoices: 5, options: [{ value: "a", label: "a" }, { value: "b", label: "b" }] }] },
    { ...full, fields: [{ id: "x", type: "number", label: "x", min: 5, max: 1 }] },
    { ...full, fields: [{ id: "x", type: "scale", label: "x", from: 1, to: 1 }] },
    { ...full, fields: [{ id: "x", type: "date", label: "x", min: "2026-02-31" }] },
    { ...full, fields: [{ id: "x", type: "text", label: "" }] },
  ]
  for (const b of broken)
    assert.throws(() => defineForm(b), (e: unknown) => e instanceof FormError && e.code === "invalid_definition", JSON.stringify(b).slice(0, 80))
  assert.equal(formDefinitionSchema.safeParse(full).success, true)
})

test("slug and dates", () => {
  assert.equal(slugSchema.safeParse("mi-encuesta-1").success, true)
  for (const s of ["", "a", "Mayus", "con espacio", "-x", "../x", "a".repeat(64)]) assert.equal(slugSchema.safeParse(s).success, false, s)
  assert.equal(isIsoDate("2024-02-29"), true)
  for (const d of ["2026-02-29", "2026-13-01", "26-01-01", "2026-1-1"]) assert.equal(isIsoDate(d), false, d)
})

test("validateAnswers: a good submission is normalized", () => {
  const r = validateAnswers(def, { ...good, extra: "ignored", constructor: "x" })
  assert.deepEqual(r, {
    ok: true,
    answers: { name: "Ana", age: 30, color: "red", tags: ["a", "c"], stars: 4, when: "2026-06-30", mail: "ana@example.com", ok: true },
  })
})

test("validateAnswers: required, empty optionals and consent", () => {
  assert.deepEqual(errorsOf({}), { name: "required", ok: "required" })
  assert.deepEqual(errorsOf({ name: "   ", ok: "on" }), { name: "required" })
  const r = validateAnswers(def, { name: "A", ok: true, bio: "", tags: [], age: null })
  assert.deepEqual(r, { ok: true, answers: { name: "A", ok: true } })
  assert.equal(errorsOf({ name: "A", ok: "maybe" }).ok, "invalid")
  assert.equal(errorsOf({ name: "A", ok: "false" }).ok, "required")
})

test("validateAnswers: text, email, number, scale, date limits", () => {
  const base = { name: "A", ok: "on" }
  assert.equal(errorsOf({ ...base, name: "x".repeat(11) }).name, "too_long")
  assert.equal(errorsOf({ ...base, name: ["a", "b"] }).name, "invalid")
  assert.equal(errorsOf({ ...base, mail: "no-es-correo" }).mail, "invalid")
  assert.equal(errorsOf({ ...base, age: "1.5" }).age, "invalid")
  assert.equal(errorsOf({ ...base, age: "1e2" }).age, "invalid")
  assert.equal(errorsOf({ ...base, age: "-1" }).age, "too_small")
  assert.equal(errorsOf({ ...base, age: 121 }).age, "too_big")
  assert.equal(errorsOf({ ...base, age: "NaN" }).age, "invalid")
  assert.equal(errorsOf({ ...base, stars: "6" }).stars, "invalid")
  assert.equal(errorsOf({ ...base, stars: "0" }).stars, "invalid")
  assert.equal(errorsOf({ ...base, stars: "2.5" }).stars, "invalid")
  assert.equal(errorsOf({ ...base, when: "2025-12-31" }).when, "too_small")
  assert.equal(errorsOf({ ...base, when: "2027-01-01" }).when, "too_big")
  assert.equal(errorsOf({ ...base, when: "2026-02-30" }).when, "invalid")
})

test("validateAnswers: single and multiple choice", () => {
  const base = { name: "A", ok: "on" }
  assert.equal(errorsOf({ ...base, color: "green" }).color, "not_option")
  assert.equal(errorsOf({ ...base, color: ["red", "blue"] }).color, "invalid")
  assert.equal(errorsOf({ ...base, tags: ["a", "zzz"] }).tags, "not_option")
  assert.equal(errorsOf({ ...base, tags: ["a", "b", "c"] }).tags, "too_many")
  const dup = validateAnswers(def, { ...base, tags: ["b", "b", "a"] })
  assert.deepEqual(dup.ok && dup.answers.tags, ["a", "b"])
  const lone = validateAnswers(def, { ...base, tags: "c" })
  assert.deepEqual(lone.ok && lone.answers.tags, ["c"])
})

test("answerText shows labels, not option values", () => {
  const color = def.fields.find((f) => f.id === "color")!
  const tags = def.fields.find((f) => f.id === "tags")!
  const ok = def.fields.find((f) => f.id === "ok")!
  assert.equal(answerText(color, "red", "es", "Sí"), "r")
  assert.equal(answerText(tags, ["a", "c"], "es", "Sí"), "a, c")
  assert.equal(answerText(ok, true, "es", "Sí"), "Sí")
  assert.equal(answerText(color, undefined, "es", "Sí"), "")
})

test("summarize: choices, scale distribution, numbers, text, dates, consent", () => {
  const sat = defineForm(satisfactionDefinition())
  const rows: Answers[] = [
    { rating: 5, channel: "web", improve: ["speed"], comment: "uno" },
    { rating: 3, channel: "web", improve: ["speed", "price"], comment: "dos" },
    { rating: 4, channel: "phone" },
    { rating: 99, channel: "fax", improve: "weird" },
  ]
  const s = summarize(sat, rows)
  assert.equal(s.total, 4)
  const by = (id: string) => s.fields.find((f) => f.id === id)!
  const rating = by("rating")
  assert.equal(rating.kind === "numeric" && rating.answered, 3)
  assert.equal(rating.kind === "numeric" && rating.average, 4)
  assert.deepEqual(rating.kind === "numeric" && rating.distribution.map((d) => d.count), [0, 0, 1, 1, 1])
  const channel = by("channel")
  assert.deepEqual(channel.kind === "choice" && channel.counts, [
    { value: "web", count: 2 },
    { value: "whatsapp", count: 0 },
    { value: "phone", count: 1 },
  ])
  assert.equal(channel.kind === "choice" && channel.answered, 3)
  const improve = by("improve")
  assert.deepEqual(improve.kind === "choice" && improve.counts.map((c) => c.count), [2, 0, 1])
  const comment = by("comment")
  assert.deepEqual(comment.kind === "text" && comment.latest, ["uno", "dos"])

  const w = defineForm(workshopDefinition())
  const ws = summarize(w, [{ date: "2026-12-05", people: 3, consent: true }, { date: "2026-11-20", people: 5, consent: true }, { people: "x" }] as Answers[])
  const date = ws.fields.find((f) => f.id === "date")!
  assert.deepEqual(date.kind === "date" && [date.earliest, date.latest], ["2026-11-20", "2026-12-05"])
  const people = ws.fields.find((f) => f.id === "people")!
  assert.equal(people.kind === "numeric" && people.average, 4)
  assert.equal(ws.fields.find((f) => f.id === "consent")!.answered, 2)
  assert.deepEqual(summarize(w, []).total, 0)
})

test("planSubmission: honeypot, closed, one per person, validation", () => {
  const form = { status: "open" as const, onePerPerson: false, definition: def }
  const raw = { name: "Ana", ok: "on" }
  const base = { honeypot: "", userId: null, raw }
  const ok = planSubmission(form, base)
  assert.equal(ok.kind, "accepted")
  assert.equal(ok.kind === "accepted" && ok.respondentKey, null)
  assert.deepEqual(planSubmission(form, { ...base, honeypot: "http://spam" }), { kind: "ignored" })
  assert.deepEqual(planSubmission({ ...form, status: "closed" }, base), { kind: "rejected", code: "closed" })
  assert.deepEqual(planSubmission({ ...form, status: "draft" }, base), { kind: "rejected", code: "closed" })
  // the honeypot wins even on a closed form: nothing is revealed to a bot
  assert.deepEqual(planSubmission({ ...form, status: "closed" }, { ...base, honeypot: "x" }), { kind: "ignored" })
  const one = { ...form, onePerPerson: true }
  assert.deepEqual(planSubmission(one, base), { kind: "rejected", code: "login_required" })
  const signed = planSubmission(one, { ...base, userId: "u-1" })
  assert.equal(signed.kind === "accepted" && signed.respondentKey, "u:u-1")
  const bad = planSubmission(form, { ...base, raw: {} })
  assert.equal(bad.kind, "invalid")
})

test("catalog: same keys in es and en, and a text per error code", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  for (const code of ["unauthenticated", "forbidden", "invalid_input", "invalid_definition", "not_found", "slug_taken", "closed", "login_required", "already_responded", "rate_limited", "unknown"])
    assert.ok(code in es.forms.errors, code)
  for (const code of ["required", "invalid", "too_long", "too_small", "too_big", "not_option", "too_many"])
    assert.ok(code in es.forms.fieldErrors, code)
})

test("permissions: read and write; member only reads", () => {
  assert.deepEqual(permissions.statement, { form: ["read", "write"] })
  assert.deepEqual(permissions.grants.member, { form: ["read"] })
})

test("manifest: tables, migration, routes and covers", () => {
  const m = JSON.parse(readFileSync(join(process.cwd(), "modules/forms/manifest.json"), "utf8"))
  assert.deepEqual(m.tables, ["forms_forms", "forms_responses"])
  assert.deepEqual(m.migrations, ["0115_forms_init"])
  assert.deepEqual(m.routes.map((r: { path: string }) => r.path), ["/forms", "/forms/[id]", "/f/[slug]"])
  assert.equal(m.routes.find((r: { path: string }) => r.path === "/f/[slug]").group, "marketing")
})

test("source: admin actions guard session + permission first; the public one limits, validates and never trusts the user", () => {
  const dir = join(process.cwd(), "modules", "forms", "server")
  const admin = readFileSync(join(dir, "actions.ts"), "utf8")
  assert.match(admin, /^"use server"/)
  const exported = admin.match(/export async function \w+/g) ?? []
  const guarded = admin.match(/await actionSession\("\/forms", "write"\)/g) ?? []
  assert.equal(exported.length, 3)
  assert.equal(guarded.length, 3)
  for (const body of admin.split("export async function").slice(1))
    assert.ok(body.indexOf("actionSession(") < body.indexOf("formData.get("), "the guard comes before reading input")

  const pub = readFileSync(join(dir, "public-actions.ts"), "utf8")
  assert.match(pub, /^"use server"/)
  assert.match(pub, /consume\(/)
  assert.match(pub, /planSubmission\(/)
  assert.match(pub, /userId: session\?\.user\.id/)
  assert.ok(pub.indexOf("consume(") < pub.indexOf("insertResponse("))
  assert.doesNotMatch(pub, /formData\.get\("(userId|user_id|respondent)/)
  // "use server" files may only export async functions
  assert.equal((pub.match(/^export (const|let|var)/gm) ?? []).length, 0)
  assert.equal((admin.match(/^export (const|let|var)/gm) ?? []).length, 0)

  const store = readFileSync(join(dir, "store.ts"), "utf8")
  assert.doesNotMatch(store, /sql`/)
})
