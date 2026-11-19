/**
 * discounts v0.1 — what can be tested WITHOUT a database: one test (or more)
 * per money rule of MODULE.md, plus texts, permissions and the manifest. Some
 * guarantees are checked by reading the code (as orders does): that order of
 * operations IS the guarantee, and the database tests (discounts-db.test.ts)
 * run it for real. Pure imports only (relative), so it also runs transpiled
 * without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  applyDiscount,
  cappedAmount,
  capErrorFromMessage,
  codeState,
  formatPercent,
  isCapReached,
  normalizeCode,
  orderErrorToDiscount,
  parsePercent,
  rawAmount,
  rejectionError,
  releaseDecision,
  ruleProblems,
} from "../contracts/domain"
import { createCodeSchema, redeemSchema, toCodeData, type CodeFormInput } from "../contracts/input"
import { DISCOUNT_ERROR_CODES, DISCOUNT_REJECTIONS, RELEASE_REASONS, type DiscountRule } from "../contracts/types"
import { en, es } from "../messages"
import { nav } from "../nav"
import { permissions } from "../permissions"

/** The module folder (tests run from the repo root; no `__dirname` under tsx/ESM). */
const DIR = join(process.cwd(), "modules/discounts")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")
/** Source of a TS file without comments, to read the order of calls. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const NOW = new Date("2026-11-15T15:00:00Z")
const none = { usesTotal: 0, usesByUser: 0 }
const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  id: "c1",
  code: "VERANO10",
  kind: "percent",
  percentBp: 1000,
  amountMinor: null,
  currency: null,
  minSubtotalMinor: null,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  maxUsesPerUser: null,
  active: true,
  ...over,
})
const clp = (subtotalMinor: number) => ({ subtotalMinor, currency: "CLP" })
const form = (over: Partial<CodeFormInput> = {}): CodeFormInput => ({
  kind: "percent",
  percent: "10",
  amount: "",
  currency: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  maxUsesPerUser: "",
  note: "",
  ...over,
})

// ── rule 1: computed on the server, rounding, total ≥ 1 ─────────────────────

test("rule 1: percentage rounds DOWN to the minor unit", () => {
  assert.deepEqual(applyDiscount(rule({ percentBp: 1500 }), clp(999), { now: NOW, usage: none }), {
    ok: true,
    amountMinor: 149,
    totalMinor: 850,
  })
  assert.equal(rawAmount(rule({ percentBp: 1250 }), 17180), 2147) // 2147.5 → 2147
  assert.equal(rawAmount(rule({ percentBp: 1 }), 9999), 0) // 0.9999 → 0
  // 10 % of 5 cents is half a cent → nothing to discount
  assert.deepEqual(applyDiscount(rule(), { subtotalMinor: 5, currency: "USD" }, { now: NOW, usage: none }), {
    ok: false,
    reason: "no_effect",
  })
})

test("rule 1: integer arithmetic, no overflow near 2^53", () => {
  const big = Number.MAX_SAFE_INTEGER
  const amount = rawAmount(rule({ percentBp: 3333 }), big)
  assert.ok(Number.isSafeInteger(amount))
  assert.equal(BigInt(amount), (BigInt(big) * BigInt(3333)) / BigInt(10000))
})

test("rule 1: fixed amount in the order's currency; the total never drops below 1", () => {
  const fixed = rule({ kind: "fixed", percentBp: null, amountMinor: 2000, currency: "CLP" })
  assert.deepEqual(applyDiscount(fixed, clp(17180), { now: NOW, usage: none }), { ok: true, amountMinor: 2000, totalMinor: 15180 })
  assert.deepEqual(applyDiscount(fixed, clp(1500), { now: NOW, usage: none }), { ok: true, amountMinor: 1499, totalMinor: 1 })
  assert.deepEqual(applyDiscount(fixed, clp(1), { now: NOW, usage: none }), { ok: false, reason: "no_effect" })
  assert.deepEqual(applyDiscount(rule({ percentBp: 10000 }), clp(500), { now: NOW, usage: none }), {
    ok: true,
    amountMinor: 499,
    totalMinor: 1,
  })
  assert.equal(cappedAmount(fixed, 0), 0)
  for (const sub of [2, 3, 10, 999, 1500, 2000, 2001, 10 ** 12])
    for (const r of [fixed, rule({ percentBp: 10000 }), rule({ percentBp: 9999 })]) {
      const res = applyDiscount(r, clp(sub), { now: NOW, usage: none })
      if (res.ok) assert.ok(res.totalMinor >= 1 && res.totalMinor === sub - res.amountMinor)
    }
})

test("rule 1: a fixed code never applies to another currency (nor without one)", () => {
  const fixed = rule({ kind: "fixed", percentBp: null, amountMinor: 500, currency: "USD" })
  assert.deepEqual(applyDiscount(fixed, clp(10000), { now: NOW, usage: none }), { ok: false, reason: "currency_mismatch" })
  assert.equal(applyDiscount(fixed, { subtotalMinor: 10000, currency: "usd" }, { now: NOW, usage: none }).ok, true)
  assert.deepEqual(applyDiscount({ ...fixed, currency: null }, clp(10000), { now: NOW, usage: none }), {
    ok: false,
    reason: "currency_mismatch",
  })
})

test("rule 1: the browser sends only a code and an order id", () => {
  const parsed = redeemSchema.parse({
    orderId: "0f8c2a5e-9b1d-4c3e-8a7f-1234567890ab",
    code: "verano10",
    amountMinor: 1,
    totalMinor: 1,
  })
  assert.deepEqual(Object.keys(parsed).sort(), ["code", "orderId"])
  // The redeem path reads the STORED order and computes with applyDiscount.
  const src = code("server/redeem.ts")
  const fn = src.slice(src.indexOf("export async function redeemCode"), src.indexOf("export async function removeDiscount"))
  assert.ok(fn.indexOf("ports.getOrder(") < fn.indexOf("applyDiscount(rule, order"))
  assert.match(fn, /amountMinor: result\.amountMinor/)
  assert.doesNotMatch(code("server/actions.ts"), /amountMinor/)
})

// ── rule 2: conditions and code normalisation ───────────────────────────────

test("rule 2: codes are normalised (upper case, no spaces) and compared that way", () => {
  assert.equal(normalizeCode("  verano 10 "), "VERANO10")
  assert.equal(normalizeCode("Verano10"), normalizeCode("VERANO10"))
  assert.equal(normalizeCode("ｖｅｒａｎｏ１０"), "VERANO10") // full-width (NFKC)
  assert.equal(normalizeCode("black-friday_2026"), "BLACK-FRIDAY_2026")
  for (const bad of ["", "ab", "a".repeat(41), "DESCUENTO!", "ÑANDÚ", 42, null, "x".repeat(300)])
    assert.equal(normalizeCode(bad), null)
})

test("rule 2: validity window (start inclusive, end exclusive) and active flag", () => {
  const r = rule({ startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-12-01T00:00:00Z") })
  const at = (iso: string) => applyDiscount(r, clp(10000), { now: new Date(iso), usage: none })
  assert.deepEqual(at("2026-10-31T23:59:59Z"), { ok: false, reason: "not_started" })
  assert.equal(at("2026-11-01T00:00:00Z").ok, true)
  assert.deepEqual(at("2026-12-01T00:00:00Z"), { ok: false, reason: "ended" })
  assert.deepEqual(applyDiscount(rule({ active: false }), clp(10000), { now: NOW, usage: none }), {
    ok: false,
    reason: "inactive",
  })
})

test("rule 2: minimum purchase is compared with the subtotal before discount", () => {
  const r = rule({ kind: "fixed", percentBp: null, amountMinor: 2000, currency: "CLP", minSubtotalMinor: 15000 })
  assert.deepEqual(applyDiscount(r, clp(14999), { now: NOW, usage: none }), { ok: false, reason: "below_minimum" })
  assert.equal(applyDiscount(r, clp(15000), { now: NOW, usage: none }).ok, true)
})

test("rule 2: caps — total and per person", () => {
  const r = rule({ maxUses: 3, maxUsesPerUser: 1 })
  assert.equal(applyDiscount(r, clp(10000), { now: NOW, usage: { usesTotal: 2, usesByUser: 0 } }).ok, true)
  assert.deepEqual(applyDiscount(r, clp(10000), { now: NOW, usage: { usesTotal: 3, usesByUser: 0 } }), {
    ok: false,
    reason: "exhausted",
  })
  assert.deepEqual(applyDiscount(r, clp(10000), { now: NOW, usage: { usesTotal: 1, usesByUser: 1 } }), {
    ok: false,
    reason: "user_limit",
  })
  assert.equal(isCapReached(r, { usesTotal: 3, usesByUser: 0 }), true)
  assert.equal(isCapReached(rule(), { usesTotal: 10 ** 6, usesByUser: 10 ** 6 }), false)
})

test("rule 2: percentages are parsed without floating point", () => {
  assert.equal(parsePercent("10"), 1000)
  assert.equal(parsePercent("12,5"), 1250)
  assert.equal(parsePercent("12.75"), 1275)
  assert.equal(parsePercent("100"), 10000)
  assert.equal(parsePercent("0.01"), 1)
  for (const bad of ["0", "100.01", "101", "1.234", "-5", "abc", ""]) assert.equal(parsePercent(bad), null)
  assert.equal(formatPercent(1250), "12.5")
  assert.equal(formatPercent(1000), "10")
  assert.equal(formatPercent(1275), "12.75")
})

test("rule 2: the admin form is checked with the same rules as the database", () => {
  assert.deepEqual(toCodeData(form()), {
    ok: true,
    data: {
      kind: "percent",
      percentBp: 1000,
      amountMinor: null,
      currency: null,
      minSubtotalMinor: null,
      startsAt: null,
      endsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      note: null,
    },
  })
  const fixed = toCodeData(form({ kind: "fixed", amount: "15.50", currency: "usd", minSubtotal: "100", maxUses: "50", maxUsesPerUser: "2" }))
  assert.ok(fixed.ok)
  assert.equal(fixed.data.amountMinor, 1550)
  assert.equal(fixed.data.currency, "USD")
  assert.equal(fixed.data.minSubtotalMinor, 10000)
  assert.equal(toCodeData(form({ kind: "fixed", amount: "2.000", currency: "CLP" })).ok, true)

  const noCurrency = toCodeData(form({ kind: "fixed", amount: "100" }))
  assert.ok(!noCurrency.ok && noCurrency.fields.currency === "currency_required")
  const minNoCurrency = toCodeData(form({ minSubtotal: "100" }))
  assert.ok(!minNoCurrency.ok && minNoCurrency.fields.currency === "currency_required")
  const dates = toCodeData(form({ startsAt: "2026-12-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" }))
  assert.ok(!dates.ok && dates.fields.endsAt === "dates_order")
  const caps = toCodeData(form({ maxUses: "1", maxUsesPerUser: "2" }))
  assert.ok(!caps.ok && caps.fields.maxUsesPerUser === "per_user_above_total")
  const zero = toCodeData(form({ maxUses: "0" }))
  assert.ok(!zero.ok && zero.fields.maxUses === "invalid")
  const pct = toCodeData(form({ percent: "150" }))
  assert.ok(!pct.ok && pct.fields.percent === "invalid")
  assert.deepEqual(ruleProblems({ ...rule(), kind: "percent", percentBp: null }), ["percent_required"])
  assert.equal(createCodeSchema.safeParse({ ...form(), code: "X", active: true, startsAt: "mañana" }).success, false)
})

test("rule 2: admin state of a code", () => {
  assert.equal(codeState(rule(), 0, NOW), "active")
  assert.equal(codeState(rule({ active: false }), 0, NOW), "inactive")
  assert.equal(codeState(rule({ startsAt: new Date("2027-01-01T00:00:00Z") }), 0, NOW), "scheduled")
  assert.equal(codeState(rule({ endsAt: new Date("2026-01-01T00:00:00Z") }), 0, NOW), "ended")
  assert.equal(codeState(rule({ maxUses: 2 }), 2, NOW), "exhausted")
})

// ── rule 3: the cap is held by the DATABASE ─────────────────────────────────

test("rule 3: redeem locks the code row, counts and inserts in the same transaction", () => {
  const src = code("server/redeem.ts")
  const fn = src.slice(src.indexOf("export async function redeemCode"), src.indexOf("export async function removeDiscount"))
  const lockCode = fn.indexOf('.selectFrom("discounts_codes")')
  assert.ok(lockCode > 0 && fn.indexOf(".forUpdate()", lockCode) > lockCode)
  assert.ok(lockCode < fn.indexOf("usageOf(trx"))
  assert.ok(fn.indexOf("usageOf(trx") < fn.indexOf('insertInto("discounts_redemptions")'))
  assert.match(fn, /return tx\(db, async \(trx\)/)
})

test("rule 3: a trigger re-checks the caps under the code's row lock on every insert", () => {
  const mig = read("db/migrations/0127_discounts_init.ts")
  assert.match(mig, /from discounts_codes where id = new\.code_id for update/)
  assert.match(mig, /before insert on discounts_redemptions/)
  assert.equal(capErrorFromMessage("discounts: usage limit reached"), "exhausted")
  assert.equal(capErrorFromMessage("discounts: per-user limit reached"), "user_limit")
  assert.equal(capErrorFromMessage("other"), null)
})

// ── rule 4: one use per order; replacing and releasing ─────────────────────

test("rule 4: one active use per order (partial unique index) and replace = release + insert", () => {
  assert.match(read("db/migrations/0127_discounts_init.ts"), /unique index discounts_redemptions_one_per_order on discounts_redemptions \(order_id\) where released_at is null/)
  const src = code("server/redeem.ts")
  const fn = src.slice(src.indexOf("export async function redeemCode"), src.indexOf("export async function removeDiscount"))
  assert.ok(fn.indexOf("lockOrderKey(trx") < fn.indexOf("lockActiveRedemption(trx"))
  assert.ok(fn.indexOf('release(trx, current.id, "replaced"') < fn.indexOf('insertInto("discounts_redemptions")'))
})

test("rule 4: a use is freed when the order is canceled, expires or is gone; confirmed when paid", () => {
  assert.deepEqual(releaseDecision("canceled"), { action: "release", reason: "order_canceled" })
  assert.deepEqual(releaseDecision("expired"), { action: "release", reason: "order_expired" })
  assert.deepEqual(releaseDecision(null), { action: "release", reason: "order_missing" })
  assert.deepEqual(releaseDecision("paid"), { action: "confirm" })
  assert.deepEqual(releaseDecision("fulfilled"), { action: "confirm" })
  assert.deepEqual(releaseDecision("pending"), { action: "keep" })
  assert.deepEqual(releaseDecision("review"), { action: "keep" })
  for (const r of RELEASE_REASONS) assert.ok(es.discounts.admin.releaseReasons[r])
})

// ── rule 5: the use and orders' discount commit together ────────────────────

test("rule 5: applyOrderDiscount runs with OUR transaction, after the use is written", () => {
  const src = code("server/redeem.ts")
  const fn = src.slice(src.indexOf("export async function redeemCode"), src.indexOf("export async function removeDiscount"))
  const insert = fn.indexOf('insertInto("discounts_redemptions")')
  const apply = fn.indexOf("ports.applyOrderDiscount(")
  assert.ok(insert > 0 && apply > insert)
  assert.match(fn.slice(apply, apply + 250), /\btrx,/)
  assert.match(code("server/ports.ts"), /applyOrderDiscount\(orderId, input, \{ db, actor \}\)/)
  // No error caught inside a transaction (25P02): no try/catch in redeem.ts transactions.
  const tx = src.slice(src.indexOf("export async function redeemCode"), src.indexOf("export async function sweepStale"))
  assert.doesNotMatch(tx, /\bcatch\b/)
})

test("rule 5: orders' refusals are translated", () => {
  assert.equal(orderErrorToDiscount("payment_started"), "payment_started")
  assert.equal(orderErrorToDiscount("invalid_status"), "order_not_pending")
  assert.equal(orderErrorToDiscount("expired"), "order_expired")
  assert.equal(orderErrorToDiscount("invalid_discount"), "order_rejected")
  assert.equal(orderErrorToDiscount("not_found"), "order_not_found")
  assert.equal(orderErrorToDiscount("zero_total"), "unknown")
})

// ── rule 6: nothing revealed, rate limited ──────────────────────────────────

test("rule 6: inactive / not started answer like an unknown code", () => {
  assert.equal(rejectionError("inactive"), "invalid_code")
  assert.equal(rejectionError("not_started"), "invalid_code")
  assert.equal(rejectionError("exhausted"), "exhausted")
  for (const r of DISCOUNT_REJECTIONS) assert.ok((DISCOUNT_ERROR_CODES as readonly string[]).includes(rejectionError(r)))
})

test("rule 6: no session → same answer before any lookup; rate limit before redeeming", () => {
  const src = code("server/actions.ts")
  const guard = src.slice(src.indexOf("async function guard"), src.indexOf("function refresh"))
  assert.ok(guard.indexOf("getSession()") < guard.indexOf("consume("))
  assert.match(guard, /if \(!session\) return \{ denied: await fail\("unauthenticated"\) \}/)
  const action = src.slice(src.indexOf("export async function redeemCodeAction"))
  assert.ok(action.indexOf("await guard()") < action.indexOf("redeemCode("))
})

// ── texts, permissions, manifest ────────────────────────────────────────────

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix]
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

test("texts: es and en have the same keys; every error code has a text", () => {
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  for (const c of DISCOUNT_ERROR_CODES) {
    assert.ok(es.discounts.errors[c], `es ${c}`)
    assert.ok(en.discounts.errors[c], `en ${c}`)
  }
  for (const p of ["invalid", "percent_required", "amount_required", "currency_required", "dates_order", "per_user_above_total"] as const)
    assert.ok(es.discounts.admin.fieldErrors[p])
})

test("permissions: discount:manage opens /admin; the admin link asks for it", () => {
  assert.deepEqual(permissions.statement, { discount: ["manage"] })
  assert.deepEqual(permissions.adminAccess, { discount: ["manage"] })
  assert.deepEqual(nav, [
    { href: "/admin/discounts", label: "discounts.nav", area: "admin", permission: { discount: ["manage"] } },
  ])
})

test("manifest: tables, migration, routes and covers", () => {
  const m = JSON.parse(read("manifest.json")) as {
    id: string
    tables: string[]
    migrations: string[]
    dependsOn: string[]
    routes: { path: string; entry: string }[]
    covers: string[]
  }
  assert.equal(m.id, "discounts")
  assert.deepEqual(m.tables, ["discounts_codes", "discounts_redemptions"])
  assert.deepEqual(m.migrations, ["0127_discounts_init"])
  assert.ok(m.dependsOn.includes("orders"))
  assert.deepEqual(
    m.routes.map((r) => r.path),
    ["/admin/discounts", "/orders/[id]/descuento"]
  )
  for (const c of ["cupón", "coupon", "descuento", "discount"]) assert.ok(m.covers.includes(c))
})
