/**
 * orders v0.1 — what can be tested WITHOUT a database: one test (or more) per
 * money rule of MODULE.md, plus the cart cookie, the cron auth, texts,
 * permissions and the manifest. Some guarantees are checked by reading the
 * code (as catalog and tickets do): that order of operations is the guarantee.
 * Pure imports only (relative), so it also runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  addToCart,
  canCancel,
  canTransition,
  decidePayment,
  normalizeCart,
  paymentTarget,
  pendingTtlMinutes,
  planCancel,
  planExpiry,
  quoteCart,
  releasesStock,
  setCartQty,
  shortOrderRef,
  stockRefOf,
  totalAfterDiscount,
  type PriceSource,
} from "../contracts/domain"
import { addToCartSchema, orderDiscountSchema, placeOrderSchema } from "../contracts/input"
import { MAX_CART_LINES, MAX_LINE_QTY, ORDER_STATUSES, type OrderStatus, type PaymentView } from "../contracts/types"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { cartKey, decodeCart, encodeCart } from "../server/cart-codec"
import { checkCronAuth } from "../server/expire/auth"

/** The module folder (tests run from the repo root; no `__dirname` under tsx/ESM). */
const DIR = join(process.cwd(), "modules/orders")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")
/** Source of a TS file without comments, to read the order of calls. */
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const ORDER_ID = "0f8c2a5e-9b1d-4c3e-8a7f-1234567890ab"
const coffee: PriceSource = { id: "i1", name: "Café de grano 250 g", sku: "ALM-CAFE-250", priceMinor: 6990, currency: "CLP" }
const bread: PriceSource = { id: "i2", name: "Pan de masa madre", sku: null, priceMinor: 3200, currency: "CLP" }
const usd: PriceSource = { id: "i3", name: "Taza", sku: null, priceMinor: 1550, currency: "USD" }

const pay = (over: Partial<PaymentView> = {}): PaymentView => ({
  id: "pay_1",
  orderId: ORDER_ID,
  status: "approved",
  amountMinor: 17180,
  currency: "CLP",
  ...over,
})
const order = (over: Partial<{ status: OrderStatus; totalMinor: number; currency: string; expiresAt: Date }> = {}) => ({
  id: ORDER_ID,
  status: "pending" as OrderStatus,
  totalMinor: 17180,
  currency: "CLP",
  expiresAt: new Date("2026-11-15T12:00:00Z"),
  ...over,
})
const BEFORE = new Date("2026-11-15T11:59:00Z")
const AFTER = new Date("2026-11-15T12:00:01Z")

// ── rule 1: the total is computed on the server from catalog ─────────────────

test("rule 1: total = Σ catalog price × qty; the browser's prices are ignored", () => {
  // A tampered cart line carrying a price: normalizeCart keeps only id + qty.
  const cart = normalizeCart([
    { itemId: "i1", qty: 2, priceMinor: 1 },
    { itemId: "i2", qty: 1, unitPrice: 0 },
  ])
  assert.deepEqual(cart, [
    { itemId: "i1", qty: 2 },
    { itemId: "i2", qty: 1 },
  ])
  const q = quoteCart(cart, [coffee, bread])
  assert.ok(q.ok)
  assert.equal(q.quote.subtotalMinor, 6990 * 2 + 3200)
  assert.equal(q.quote.currency, "CLP")
  assert.deepEqual(
    q.quote.lines.map((l) => [l.itemId, l.unitPriceMinor, l.qty, l.lineTotalMinor]),
    [
      ["i1", 6990, 2, 13980],
      ["i2", 3200, 1, 3200],
    ]
  )
})

test("rule 1: what catalog omits (not sellable) is reported, never priced", () => {
  const q = quoteCart([{ itemId: "i1", qty: 1 }, { itemId: "gone", qty: 1 }], [coffee])
  assert.deepEqual(q, { ok: false, reason: "unavailable", itemIds: ["gone"] })
  assert.deepEqual(quoteCart([], [coffee]), { ok: false, reason: "empty" })
})

test("rule 1: one currency per order", () => {
  const q = quoteCart([{ itemId: "i1", qty: 1 }, { itemId: "i3", qty: 1 }], [coffee, usd])
  assert.deepEqual(q, { ok: false, reason: "mixed_currency", currencies: ["CLP", "USD"] })
})

test("rule 1: integers only, no overflow past 2^53", () => {
  const huge: PriceSource = { ...coffee, priceMinor: Number.MAX_SAFE_INTEGER - 1 }
  assert.deepEqual(quoteCart([{ itemId: "i1", qty: 2 }], [huge]), { ok: false, reason: "too_large" })
  assert.deepEqual(quoteCart([{ itemId: "i1", qty: 1 }], [{ ...coffee, priceMinor: 1.5 }]), { ok: false, reason: "too_large" })
})

test("rule 1: no browser schema carries a price or an amount to charge", () => {
  const parsed = placeOrderSchema.parse({ expectedSubtotalMinor: 100, currency: "CLP", totalMinor: 1, priceMinor: 1 })
  assert.deepEqual(Object.keys(parsed).sort(), ["currency", "expectedSubtotalMinor"])
  const add = addToCartSchema.parse({ itemId: "i1", qty: 1, priceMinor: 1 })
  assert.deepEqual(Object.keys(add).sort(), ["itemId", "qty"])
  // and the actions never read a price field from their input
  const actions = code("server/actions.ts")
  assert.ok(!/input\.(price|amount|total)/i.test(actions))
  assert.ok(!/parsed\.data\.(price|amount|total)/i.test(actions))
})

test("rule 1: createOrder reserves stock (locks the rows) BEFORE reading prices, in the same transaction", () => {
  const src = code("server/lifecycle.ts")
  const body = src.slice(src.indexOf("export async function createOrder"), src.indexOf("export async function applyPayment"))
  const reserve = body.indexOf("ports.reserveStock(")
  const prices = body.indexOf("ports.getSellableItems(")
  const insert = body.indexOf('insertInto("orders_orders")')
  assert.ok(reserve > 0 && prices > reserve && insert > prices, "reserve → prices → insert")
  assert.match(body, /reserveStock\(\{ ref, lines: cart, createdBy: input\.userId \}, \{ db: trx \}\)/)
  assert.match(body, /\{ db: trx \}\s*\)\s*const q = quoteCart/)
  assert.match(body, /prices_changed/)
  // and startOrderPayment charges the STORED total
  assert.match(src, /amountMinor: order\.totalMinor/)
})

// ── rule 2: each line is a photo ─────────────────────────────────────────────

test("rule 2: the order stores name, unit price, qty and line total; the database refuses to update a line", () => {
  const src = code("server/lifecycle.ts")
  for (const col of ["name: l.name", "sku: l.sku", "unit_price_minor: l.unitPriceMinor", "qty: l.qty", "line_total_minor: l.lineTotalMinor"])
    assert.ok(src.includes(col), col)
  const mig = read("db/migrations/0126_orders_init.ts")
  assert.match(mig, /create trigger orders_items_frozen before update on orders_items/)
  assert.match(mig, /check \(line_total_minor = unit_price_minor \* qty\)/)
  assert.match(mig, /amounts are frozen once the order leaves pending/)
  // and nothing in the module ever updates orders_items
  for (const f of ["server/lifecycle.ts", "server/store.ts", "server/actions.ts"])
    assert.ok(!code(f).includes('updateTable("orders_items")'), f)
})

// ── rule 3: paid only with an approved payment for the stored amount ─────────

test("rule 3: approved + same amount + same currency → paid; anything else is not", () => {
  assert.equal(decidePayment(order(), pay()), "mark_paid")
  assert.equal(decidePayment(order(), pay({ currency: "clp" })), "mark_paid")
  assert.equal(decidePayment(order(), pay({ amountMinor: 17179 })), "mark_review")
  assert.equal(decidePayment(order(), pay({ currency: "USD" })), "mark_review")
  assert.equal(decidePayment(order(), pay({ status: "needs_review" })), "mark_review")
  assert.equal(decidePayment(order(), pay({ status: "refunded" })), "mark_review")
  for (const s of ["pending", "failed", "canceled"] as const) assert.equal(decidePayment(order(), pay({ status: s })), "none")
  assert.equal(decidePayment(order(), null), "none")
  // a payment of ANOTHER order never pays this one
  assert.equal(decidePayment(order(), pay({ orderId: "other" })), "none")
})

test("rule 3: needs_review is never fulfilled; paying is idempotent (paid + approved → no change)", () => {
  assert.equal(paymentTarget("pending", "mark_paid"), "paid")
  assert.equal(paymentTarget("review", "mark_paid"), "paid")
  assert.equal(paymentTarget("paid", "mark_paid"), null)
  assert.equal(paymentTarget("fulfilled", "mark_paid"), null)
  assert.equal(paymentTarget("pending", "mark_review"), "review")
  assert.equal(paymentTarget("review", "mark_review"), null)
  assert.ok(!canTransition("review", "fulfilled"))
  assert.ok(!canTransition("pending", "fulfilled"))
  // fulfil re-checks the payment at that moment
  const src = code("server/lifecycle.ts")
  const body = src.slice(src.indexOf("export async function fulfillOrder"), src.indexOf("export async function applyOrderDiscount"))
  assert.match(body, /decidePayment\(order, payment\) !== "mark_paid"/)
})

test("rule 3: the paid transition is atomic: row lock + `where status = <from>` + database trigger", () => {
  const src = code("server/lifecycle.ts")
  const apply = src.slice(src.indexOf("export async function applyPayment"), src.indexOf("export type ReleaseOutcome"))
  assert.ok(apply.indexOf("lockOrder(trx") < apply.indexOf("ports.getPaymentByOrder"), "lock before reading the payment")
  assert.match(src, /\.where\("status", "=", order\.status\)/)
  const mig = read("db/migrations/0126_orders_init.ts")
  assert.match(mig, /orders_paid_has_payment/)
  assert.match(mig, /transition % -> % not allowed/)
  assert.match(code("server/store.ts"), /\.forUpdate\(\)/)
})

// ── rule 4: stock reserved on create, released exactly once, never when paid ─

test("rule 4: only canceled/expired release stock, and a paid order can never get there", () => {
  for (const s of ORDER_STATUSES) assert.equal(releasesStock(s), s === "canceled" || s === "expired", s)
  for (const from of ["paid", "fulfilled", "canceled", "expired"] as const) {
    assert.ok(!canTransition(from, "canceled"), `${from} → canceled`)
    assert.ok(!canTransition(from, "expired"), `${from} → expired`)
  }
  assert.ok(!canCancel("paid", true))
  assert.ok(!canCancel("review", false))
  assert.ok(canCancel("review", true))
  assert.equal(planCancel(order({ status: "paid" }), pay(), true).action, "skip")
})

test("rule 4: release happens in the SAME transaction as the status change, and only once", () => {
  const src = code("server/lifecycle.ts")
  const body = src.slice(src.indexOf("async function transition"), src.indexOf("export type CreateOrderInput"))
  assert.match(body, /ports\.releaseStock\([\s\S]*\{ db: trx \}\s*\)/)
  assert.match(body, /stock_released_at: now/)
  const mig = read("db/migrations/0126_orders_init.ts")
  assert.match(mig, /orders_released_iff_closed/)
  assert.match(mig, /stock is released only once/)
})

test("rule 4: cancelling or expiring looks at the payment first", () => {
  // approved meanwhile → paid, not released
  assert.deepEqual(planExpiry(order(), pay(), AFTER), { action: "to", status: "paid" })
  assert.deepEqual(planCancel(order(), pay(), false), { action: "to", status: "paid" })
  // an open checkout is cancelled in payments before giving stock back
  assert.deepEqual(planExpiry(order(), pay({ status: "pending" }), AFTER), {
    action: "cancel_payment_then_release",
    paymentId: "pay_1",
  })
  assert.deepEqual(planCancel(order(), pay({ status: "failed" }), false), {
    action: "cancel_payment_then_release",
    paymentId: "pay_1",
  })
  // nothing open → release
  assert.deepEqual(planExpiry(order(), null, AFTER), { action: "release" })
  assert.deepEqual(planExpiry(order(), pay({ status: "canceled" }), AFTER), { action: "release" })
  // needs_review: the buyer cannot cancel it away; staff can
  assert.deepEqual(planCancel(order(), pay({ status: "needs_review" }), false), { action: "to", status: "review" })
  assert.deepEqual(planCancel(order({ status: "review" }), pay({ status: "needs_review" }), true), { action: "release" })
})

test("rule 4: the stock reference is the order's", () => {
  assert.equal(stockRefOf(ORDER_ID), `order:${ORDER_ID}`)
  assert.match(read("db/migrations/0126_orders_init.ts"), /check \(stock_ref = 'order:' \|\| id\)/)
})

// ── rule 5: pending orders expire ────────────────────────────────────────────

test("rule 5: expiry waits for the clock and skips what is not pending", () => {
  assert.deepEqual(planExpiry(order(), null, BEFORE), { action: "not_due" })
  assert.deepEqual(planExpiry(order(), null, AFTER), { action: "release" })
  for (const s of ["review", "paid", "fulfilled", "canceled", "expired"] as const)
    assert.deepEqual(planExpiry(order({ status: s }), null, AFTER), { action: "skip" }, s)
})

test("rule 5: TTL is configurable and clamped", () => {
  assert.equal(pendingTtlMinutes(undefined), 30)
  assert.equal(pendingTtlMinutes("45"), 45)
  assert.equal(pendingTtlMinutes("1"), 5)
  assert.equal(pendingTtlMinutes("999999"), 10080)
  assert.equal(pendingTtlMinutes("abc"), 30)
  assert.equal(pendingTtlMinutes("-5"), 30)
})

test("rule 5: expirePendingOrders is exposed in contracts and the cron route authenticates first", () => {
  assert.match(read("contracts/index.ts"), /export const expirePendingOrders/)
  const secret = "s".repeat(32)
  assert.equal(checkCronAuth(`Bearer ${secret}`, secret), "ok")
  assert.equal(checkCronAuth(`Bearer ${secret}x`, secret), "unauthorized")
  assert.equal(checkCronAuth(null, secret), "unauthorized")
  assert.equal(checkCronAuth("Bearer ", secret), "unauthorized")
  assert.equal(checkCronAuth(`Bearer ${secret}`, undefined), "not_configured")
  assert.equal(checkCronAuth("Bearer short", "short"), "not_configured")
  const route = code("server/expire/route.ts")
  assert.ok(route.indexOf("checkCronAuth") < route.indexOf("expirePendingOrders()"))
})

// ── rule 6: visibility and history ───────────────────────────────────────────

test("rule 6: member reads (own orders); manage sees all and opens /admin", () => {
  assert.deepEqual(permissions.statement, { order: ["read", "manage"] })
  assert.deepEqual(permissions.grants, { member: { order: ["read"] } })
  assert.deepEqual(permissions.adminAccess, { order: ["manage"] })
  const store = code("server/store.ts")
  const mine = store.slice(store.indexOf("export async function listOrdersForUser"), store.indexOf("export type AdminOrderRow"))
  assert.match(mine, /\.where\("user_id", "=", userId\)/)
  const page = code("ui/order-page.tsx")
  assert.match(page, /canSeeOrder\(viewer, first\)\) notFound\(\)/)
  assert.match(code("ui/admin-page.tsx"), /requirePagePermission\("\/admin\/orders", "manage"\)/)
  assert.match(code("ui/orders-page.tsx"), /listOrdersForUser\(getKysely\(\), session\.user\.id\)/)
})

test("rule 6: every status change writes history with its author", () => {
  const src = code("server/lifecycle.ts")
  const transition = src.slice(src.indexOf("async function transition"), src.indexOf("export type CreateOrderInput"))
  assert.match(transition, /await writeHistory\(trx, order\.id, order\.status, to, actor/)
  assert.match(src, /writeHistory\(trx, id, null, "pending", \{ kind: "buyer", userId: input\.userId \}/)
  // status is only written inside transition (plus the initial insert)
  const sets = src.match(/[^_]status: to,/g) ?? []
  assert.equal(sets.length, 1)
  assert.match(read("db/migrations/0126_orders_init.ts"), /orders_history_actor check \(\(actor_kind = 'system'\) = \(actor_id is null\)\)/)
})

test("rule 6: every Server Action checks session + permission before touching data", () => {
  const src = code("server/actions.ts")
  for (const name of ["placeOrderAction", "payOrderAction", "cancelOrderAction", "fulfillOrderAction"]) {
    const start = src.indexOf(`export async function ${name}`)
    const body = src.slice(start, src.indexOf("\nexport ", start + 10))
    const guard = body.indexOf("actionSession(")
    assert.ok(guard > 0, `${name} has a guard`)
    for (const w of ["createOrder(", "startOrderPayment(", "releaseOrder(", "fulfillOrder(", "getOrder("]) {
      const at = body.indexOf(w)
      if (at > 0) assert.ok(guard < at, `${name}: guard before ${w}`)
    }
  }
  assert.match(src, /actionSession\("\/admin\/orders", "manage"\)/)
})

// ── rule 7: the cart ─────────────────────────────────────────────────────────

test("rule 7: signed cookie round-trip with ids and quantities only", () => {
  const key = cartKey("a-test-secret-that-is-long-enough")
  const value = encodeCart([{ itemId: "i1", qty: 2 }, { itemId: "i2", qty: 1 }], key)
  assert.ok(value)
  assert.deepEqual(decodeCart(value, key), [
    { itemId: "i1", qty: 2 },
    { itemId: "i2", qty: 1 },
  ])
  const payload = JSON.parse(Buffer.from(value.split(".")[0]!, "base64url").toString("utf8"))
  assert.deepEqual(payload, [["i1", 2], ["i2", 1]])
})

test("rule 7: a tampered or foreign cookie is dropped whole", () => {
  const key = cartKey("a-test-secret-that-is-long-enough")
  const value = encodeCart([{ itemId: "i1", qty: 2 }], key)!
  const [payload, sig] = value.split(".") as [string, string]
  const forged = Buffer.from(JSON.stringify([["i1", 500]])).toString("base64url")
  assert.deepEqual(decodeCart(`${forged}.${sig}`, key), [])
  assert.deepEqual(decodeCart(`${payload}.${sig.slice(1)}`, key), [])
  assert.deepEqual(decodeCart(value, cartKey("another-secret-of-enough-length")), [])
  assert.deepEqual(decodeCart("garbage", key), [])
  assert.deepEqual(decodeCart(undefined, key), [])
  assert.deepEqual(decodeCart(`${payload}.${sig}.x`, key), [])
})

test("rule 7: cart limits (qty per line, distinct lines, cookie size)", () => {
  assert.deepEqual(addToCart([{ itemId: "i1", qty: MAX_LINE_QTY }], "i1", 5), { ok: true, cart: [{ itemId: "i1", qty: MAX_LINE_QTY }] })
  assert.deepEqual(addToCart([], "i1", 0), { ok: false, reason: "invalid" })
  const full = Array.from({ length: MAX_CART_LINES }, (_, i) => ({ itemId: `i${i}`, qty: 1 }))
  assert.deepEqual(addToCart(full, "new", 1), { ok: false, reason: "full" })
  assert.equal(normalizeCart([...full, { itemId: "x", qty: 1 }]).length, MAX_CART_LINES)
  assert.deepEqual(setCartQty([{ itemId: "i1", qty: 3 }], "i1", 0), { ok: true, cart: [] })
  assert.deepEqual(setCartQty([{ itemId: "i1", qty: 3 }], "i1", MAX_LINE_QTY + 1), { ok: false, reason: "invalid" })
  const key = cartKey("a-test-secret-that-is-long-enough")
  const big = Array.from({ length: MAX_CART_LINES }, (_, i) => ({ itemId: `${"x".repeat(95)}${i}`, qty: 1 }))
  assert.equal(encodeCart(big, key), null)
})

// ── discounts hook ───────────────────────────────────────────────────────────

test("discount hook: total = subtotal − discount, at least 1; input is validated", () => {
  assert.equal(totalAfterDiscount(10000, 0), 10000)
  assert.equal(totalAfterDiscount(10000, 2500), 7500)
  assert.equal(totalAfterDiscount(10000, 9999), 1)
  assert.equal(totalAfterDiscount(10000, 10000), null)
  assert.equal(totalAfterDiscount(10000, -1), null)
  assert.equal(totalAfterDiscount(10000, 1.5), null)
  assert.ok(!orderDiscountSchema.safeParse({ amountMinor: -1, code: "X", ref: null }).success)
  assert.ok(orderDiscountSchema.safeParse({ amountMinor: 500, code: "VERANO10", ref: "discount:1" }).success)
  const src = code("server/lifecycle.ts")
  const body = src.slice(src.indexOf("export async function applyOrderDiscount"), src.indexOf("export type StartPaymentResult"))
  assert.match(body, /payment_started/)
  assert.match(body, /order\.status !== "pending"/)
})

// ── texts, manifest ──────────────────────────────────────────────────────────

function leaves(o: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === "string") out.set(key, v)
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv)
  }
  return out
}
const args = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort()

test("texts: es and en have the same keys and ICU arguments, none empty", () => {
  const a = leaves(es)
  const b = leaves(en)
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort())
  for (const [k, v] of a) {
    assert.ok(v.trim().length > 0 && b.get(k)!.trim().length > 0, k)
    assert.deepEqual(args(v), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["orders"])
})

test("manifest: tables, migration, routes, dependsOn, covers", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "orders")
  assert.deepEqual(m.tables, ["orders_orders", "orders_items", "orders_status_history"])
  assert.deepEqual(m.migrations, ["0126_orders_init"])
  assert.deepEqual(m.routes.map((r: { path: string }) => r.path), [
    "/carrito",
    "/checkout",
    "/orders",
    "/orders/[id]",
    "/admin/orders",
    "/api/orders/expire",
  ])
  for (const d of ["catalog", "payments"]) assert.ok(m.dependsOn.includes(d))
  for (const c of ["pedido", "order", "carrito", "cart"]) assert.ok(m.covers.includes(c))
  assert.equal(shortOrderRef(ORDER_ID), "0F8C2A5E")
})
