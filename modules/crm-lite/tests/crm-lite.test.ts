/**
 * crm-lite v0.1 — what can be tested WITHOUT a database: money parsing (minor
 * units, no floats), stage moves, search escaping, the Zod schemas, the
 * catalog (es/en parity), the manifest, and — reading the code — that every
 * Server Action checks session + permission before writing and that the
 * stage move is guarded by the current stage (optimistic concurrency).
 * Pure imports only (relative), so it also runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  DEAL_STAGES,
  isClosedStage,
  isDealStage,
  likePattern,
  planMove,
} from "../contracts/domain"
import { crmSchemas, upsertContactSchema } from "../contracts/input"
import {
  currencyExponent,
  formatAmountInput,
  minorToMajor,
  parseAmount,
} from "../contracts/money"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(__dirname, "..")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

// ── money ────────────────────────────────────────────────────────────────────

test("currencyExponent: CLP 0, USD 2", () => {
  assert.equal(currencyExponent("CLP"), 0)
  assert.equal(currencyExponent("USD"), 2)
  assert.equal(minorToMajor(1550, "USD"), 15.5)
  assert.equal(minorToMajor(1500, "CLP"), 1500)
})

test("parseAmount: CLP treats every separator as thousands", () => {
  assert.equal(parseAmount("1.500.000", "CLP"), 1500000)
  assert.equal(parseAmount("1,500,000", "CLP"), 1500000)
  assert.equal(parseAmount(" 2 400 000 ", "CLP"), 2400000)
  assert.equal(parseAmount("0", "CLP"), 0)
})

test("parseAmount: USD reads the last separator as decimal when 1-2 digits follow", () => {
  assert.equal(parseAmount("15", "USD"), 1500)
  assert.equal(parseAmount("15.5", "USD"), 1550)
  assert.equal(parseAmount("15,50", "USD"), 1550)
  assert.equal(parseAmount("1,234.56", "USD"), 123456)
  assert.equal(parseAmount("1.234,56", "USD"), 123456)
  assert.equal(parseAmount("1,234", "USD"), 123400) // 3 digits → thousands
  assert.equal(parseAmount("0.1", "USD"), 10)
  // no floating-point drift
  assert.equal(parseAmount("0.29", "USD"), 29)
  assert.equal(parseAmount("1.15", "USD"), 115)
})

test("parseAmount: rejects negatives, text, empty and absurd amounts", () => {
  for (const bad of ["", "-5", "abc", "1..5", "5.", ".5", "1e5", "1.234.5x", "9".repeat(20)])
    assert.equal(parseAmount(bad, "USD"), null, bad)
  assert.equal(parseAmount("-1000", "CLP"), null)
})

test("formatAmountInput: round-trips through parseAmount", () => {
  for (const [minor, cur] of [
    [0, "USD"],
    [5, "USD"],
    [1550, "USD"],
    [123456, "USD"],
    [1500000, "CLP"],
  ] as const) {
    assert.equal(parseAmount(formatAmountInput(minor, cur), cur), minor)
  }
  assert.equal(formatAmountInput(5, "USD"), "0.05")
})

// ── stages ───────────────────────────────────────────────────────────────────

test("planMove: same stage is a no-op; won/lost close; won promotes the contact", () => {
  assert.equal(planMove("new", "new"), null)
  assert.deepEqual(planMove("new", "won"), {
    stage: "won",
    closeNow: true,
    reopen: false,
    promoteContact: true,
  })
  const lost = planMove("proposal", "lost")
  assert.equal(lost?.closeNow, true)
  assert.equal(lost?.promoteContact, false)
  const reopened = planMove("lost", "negotiation")
  assert.equal(reopened?.closeNow, false)
  assert.equal(reopened?.reopen, true)
})

test("stages: closed set and guard", () => {
  assert.deepEqual(
    DEAL_STAGES.filter(isClosedStage),
    ["won", "lost"]
  )
  assert.equal(isDealStage("won"), true)
  assert.equal(isDealStage("WON"), false)
  assert.equal(isDealStage(undefined), false)
})

test("likePattern: %, _ and \\ are matched literally", () => {
  assert.equal(likePattern("ana"), "%ana%")
  assert.equal(likePattern("50%_x\\"), "%50\\%\\_x\\\\%")
})

// ── schemas ──────────────────────────────────────────────────────────────────

const v = {
  required: "REQ",
  tooLong: "LONG",
  email: "EMAIL",
  amount: "AMOUNT",
  invalid: "INVALID",
}
const { contactSchema, dealSchema, activitySchema, moveSchema } = crmSchemas(v)
const contact = {
  name: "Ana",
  email: "",
  phone: "",
  company: "",
  status: "lead" as const,
  notes: "",
}

test("contact schema: name required, email optional but valid, localized messages", () => {
  assert.equal(contactSchema.safeParse(contact).success, true)
  const noName = contactSchema.safeParse({ ...contact, name: "   " })
  assert.equal(noName.success, false)
  assert.equal(noName.error?.issues[0].message, "REQ")
  const badEmail = contactSchema.safeParse({ ...contact, email: "nope" })
  assert.equal(badEmail.error?.issues[0].message, "EMAIL")
  assert.equal(
    contactSchema.safeParse({ ...contact, email: "ana@ejemplo.cl" }).success,
    true
  )
  const badStatus = contactSchema.safeParse({ ...contact, status: "vip" })
  assert.equal(badStatus.error?.issues[0].message, "INVALID")
})

test("deal schema: amount validated against the chosen currency", () => {
  const deal = { name: "Web", amount: "", currency: "CLP", stage: "new" }
  assert.equal(dealSchema.safeParse(deal).success, true) // empty → 0
  assert.equal(
    dealSchema.safeParse({ ...deal, amount: "1.500.000" }).success,
    true
  )
  const neg = dealSchema.safeParse({ ...deal, amount: "-3" })
  assert.equal(neg.success, false)
  assert.deepEqual(neg.error?.issues[0].path, ["amount"])
  assert.equal(neg.error?.issues[0].message, "AMOUNT")
  assert.equal(dealSchema.safeParse({ ...deal, currency: "XXX1" }).success, false)
  assert.equal(dealSchema.safeParse({ ...deal, stage: "archived" }).success, false)
})

test("activity schema: stage_change cannot be logged by hand", () => {
  const a = { kind: "note", body: "Llamó", dealId: "" }
  assert.equal(activitySchema.safeParse(a).success, true)
  assert.equal(
    activitySchema.safeParse({ ...a, kind: "stage_change" }).success,
    false
  )
  assert.equal(activitySchema.safeParse({ ...a, body: " " }).success, false)
})

test("move schema: only known stages", () => {
  assert.equal(
    moveSchema.safeParse({ id: "d1", from: "new", to: "won" }).success,
    true
  )
  assert.equal(
    moveSchema.safeParse({ id: "d1", from: "new", to: "gone" }).success,
    false
  )
  assert.equal(moveSchema.safeParse({ id: "", from: "new", to: "won" }).success, false)
})

test("upsertContact schema: lower-cases the email and requires a name", () => {
  assert.equal(
    upsertContactSchema.parse({ name: "Ana", email: " Ana@Ejemplo.CL " }).email,
    "ana@ejemplo.cl"
  )
  assert.equal(upsertContactSchema.safeParse({ name: "" }).success, false)
  assert.equal(
    upsertContactSchema.safeParse({ name: "Ana", email: "x" }).success,
    false
  )
})

// ── catalog, permissions, manifest ───────────────────────────────────────────

type Tree = { [k: string]: string | Tree }
function leaves(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, val] of Object.entries(t)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof val === "string") out.set(p, val)
    else for (const [kk, vv] of leaves(val, p)) out.set(kk, vv)
  }
  return out
}
const args = (s: string) =>
  [...s.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)].map((m) => m[1]).sort()

test("messages: es and en have the same keys and the same ICU arguments", () => {
  const a = leaves(es as unknown as Tree)
  const b = leaves(en as unknown as Tree)
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort())
  for (const [k, text] of a) {
    assert.ok(text.trim().length > 0, k)
    assert.deepEqual(args(text), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["crm-lite"])
  // every stage and status has a label
  for (const s of DEAL_STAGES) assert.ok(es["crm-lite"].stages[s])
})

test("permissions: contact and deal with read/write", () => {
  assert.deepEqual(permissions.statement, {
    contact: ["read", "write"],
    deal: ["read", "write"],
  })
})

test("manifest: tables, migration and routes match the files", () => {
  const m = JSON.parse(read("manifest.json")) as {
    id: string
    tables: string[]
    migrations: string[]
    routes: { path: string; entry: string }[]
    covers: string[]
  }
  assert.equal(m.id, "crm-lite")
  for (const t of m.tables) assert.match(t, /^crm_lite_/)
  assert.deepEqual(m.migrations, ["0105_crm_lite_init"])
  const sqlText = read("db/migrations/0105_crm_lite_init.ts")
  for (const t of m.tables) assert.ok(sqlText.includes(`create table ${t}`), t)
  for (const r of m.routes) assert.ok(read(r.entry).includes("export default"), r.entry)
  assert.ok(m.covers.includes("contacto") && m.covers.includes("deal"))
})

// ── guarantees, reading the code ─────────────────────────────────────────────

test("every Server Action checks session + permission before writing", () => {
  const src = read("server/actions.ts")
  const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(actions.sort(), [
    "createContactAction",
    "createDealAction",
    "logActivityAction",
    "moveDealAction",
    "updateContactAction",
  ])
  for (const name of actions) {
    const start = src.indexOf(`export async function ${name}(`)
    const next = src.indexOf("export async function", start + 1)
    const body = src.slice(start, next === -1 ? undefined : next)
    const guard = body.indexOf("await actionSession(")
    const parse = body.indexOf(".safeParse(")
    const write = body.search(/await (create|update|move)\w*\(/)
    assert.ok(guard > 0, `${name}: no guard`)
    assert.ok(parse > guard, `${name}: validates after the guard`)
    assert.ok(write > parse, `${name}: writes after validating`)
  }
})

test("a stage move only applies while the deal is still in `from`", () => {
  const src = read("server/mutations.ts")
  const move = src.slice(src.indexOf("export async function moveDeal("))
  assert.match(move, /\.where\("stage", "=", from\)/)
  assert.match(move, /transaction\(\)/)
})

test("migration: money is bigint minor units and closed_at follows the stage", () => {
  const sqlText = read("db/migrations/0105_crm_lite_init.ts")
  assert.match(sqlText, /amount_minor bigint/)
  assert.match(sqlText, /check \(amount_minor >= 0\)/)
  assert.match(sqlText, /\(stage in \('won', 'lost'\)\) = \(closed_at is not null\)/)
  assert.match(sqlText, /create unique index crm_lite_contacts_email_idx/)
})
