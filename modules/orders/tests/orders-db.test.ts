/**
 * orders against real Postgres, with FAKE catalog/payments ports (the real
 * ones are those modules' contracts; here we count what orders asks of them).
 * One test per money rule: server total + line photo, paid only when approved
 * for the stored amount (idempotent under concurrency), stock released exactly
 * once (concurrent cancels/expiries), never for a paid order, the expiry sweep,
 * the discount hook, and the database triggers that back all of it.
 * Creates its own schema (with a minimal "user" table) and drops it at the end.
 *
 * Skipped without DATABASE_URL — and says so.
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect, sql } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { OrderError, type CartLine, type PaymentView } from "../contracts/types"
import { up } from "../db/migrations/0126_orders_init"
import {
  applyOrderDiscount,
  applyPayment,
  createOrder,
  expireDueOrders,
  fulfillOrder,
  releaseOrder,
  startOrderPayment,
} from "../server/lifecycle"
import type { OrdersPorts } from "../server/ports"
import { getOrderDetail } from "../server/store"

const url = process.env.DATABASE_URL
const skip = url ? false : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `orders_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 10, options: `-c search_path=${schema},public` })
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await pool.query(`create table "user" (id text primary key, name text not null, email text not null)`)
  await pool.query(`insert into "user" (id, name, email) values ('ana', 'Ana Rojas', 'ana@example.test')`)
  await up(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await db.destroy()
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`drop schema ${schema} cascade`)
  await admin.end()
})

/** Fake catalog + payments that record what orders asked. */
function fakes() {
  const prices = new Map<string, { name: string; priceMinor: number; currency: string }>([
    ["i1", { name: "Café de grano 250 g", priceMinor: 6990, currency: "CLP" }],
    ["i2", { name: "Pan de masa madre", priceMinor: 3200, currency: "CLP" }],
  ])
  const payments = new Map<string, PaymentView>()
  const calls = { reserve: [] as string[], release: [] as string[], cancelPayment: 0, onPaid: 0 }
  const ports: OrdersPorts = {
    getSellableItems: async (ids) =>
      ids.flatMap((id) => {
        const p = prices.get(id)
        return p ? [{ id, slug: id, sku: null, trackStock: true, available: 10, ...p }] : []
      }),
    reserveStock: async ({ ref }) => {
      calls.reserve.push(ref)
      return {}
    },
    releaseStock: async ({ ref }) => {
      calls.release.push(ref)
      return {}
    },
    getPaymentByOrder: async (orderId) => payments.get(orderId) ?? null,
    cancelPayment: async (paymentId) => {
      for (const p of payments.values())
        if (p.id === paymentId && (p.status === "pending" || p.status === "failed")) {
          p.status = "canceled"
          calls.cancelPayment++
          return true
        }
      return false
    },
    syncPayment: async (paymentId) => {
      const p = [...payments.values()].find((x) => x.id === paymentId)
      if (!p) throw new Error("unknown")
      return p
    },
    startCheckout: async (input) => {
      const existing = payments.get(input.orderId)
      if (existing?.status === "approved") return { kind: "already_paid" }
      const p: PaymentView = { id: `pay_${input.orderId}`, orderId: input.orderId, status: "pending", amountMinor: input.amountMinor, currency: input.currency }
      payments.set(input.orderId, p)
      return { kind: "ok", paymentId: p.id, url: "https://pay.example.test/checkout" }
    },
    onPaid: async () => {
      calls.onPaid++
    },
  }
  return { ports, prices, payments, calls }
}

const CART: CartLine[] = [
  { itemId: "i1", qty: 2 },
  { itemId: "i2", qty: 1 },
]
const TOTAL = 6990 * 2 + 3200

const approve = (f: ReturnType<typeof fakes>, orderId: string, over: Partial<PaymentView> = {}) =>
  f.payments.set(orderId, { id: `pay_${orderId}`, orderId, status: "approved", amountMinor: TOTAL, currency: "CLP", ...over })

const isCode = (c: string) => (e: unknown) => e instanceof OrderError && e.code === c

test("rule 1+2: the total comes from catalog and each line is a photo", { skip }, async () => {
  const f = fakes()
  const order = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  assert.equal(order.subtotalMinor, TOTAL)
  assert.equal(order.totalMinor, TOTAL)
  assert.equal(order.status, "pending")
  assert.deepEqual(f.calls.reserve, [`order:${order.id}`])

  f.prices.set("i1", { name: "Café nuevo", priceMinor: 99999, currency: "CLP" })
  const detail = await getOrderDetail(db, order.id)
  assert.deepEqual(
    detail!.items.map((i) => [i.itemId, i.name, i.unitPriceMinor, i.qty, i.lineTotalMinor]),
    [
      ["i1", "Café de grano 250 g", 6990, 2, 13980],
      ["i2", "Pan de masa madre", 3200, 1, 3200],
    ]
  )
  await assert.rejects(sql`update orders_items set unit_price_minor = 1 where order_id = ${order.id}`.execute(db))
})

test("rule 1: if the price changed after the person looked, nothing is created", { skip }, async () => {
  const f = fakes()
  const before = await db.selectFrom("orders_orders").select(sql<number>`count(*)::int`.as("n")).executeTakeFirstOrThrow()
  await assert.rejects(
    createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30, expected: { subtotalMinor: TOTAL - 1, currency: "CLP" } }),
    isCode("prices_changed")
  )
  const afterCount = await db.selectFrom("orders_orders").select(sql<number>`count(*)::int`.as("n")).executeTakeFirstOrThrow()
  assert.equal(afterCount.n, before.n)
})

test("rule 3: approved for the stored amount → paid, once, even with concurrent calls", { skip }, async () => {
  const f = fakes()
  const order = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  assert.equal(await applyPayment(db, f.ports, order.id), "unchanged")
  approve(f, order.id)
  const results = await Promise.all(Array.from({ length: 5 }, () => applyPayment(db, f.ports, order.id)))
  assert.equal(results.filter((r) => r === "paid").length, 1)
  assert.equal(results.filter((r) => r === "already_paid").length, 4)
  assert.equal(f.calls.onPaid, 1)
  const detail = await getOrderDetail(db, order.id)
  assert.equal(detail!.status, "paid")
  assert.equal(detail!.history.filter((h) => h.toStatus === "paid").length, 1)
})

test("rule 3: approved with another amount, or needs_review → review, never paid nor fulfilled", { skip }, async () => {
  const f = fakes()
  const a = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  approve(f, a.id, { amountMinor: TOTAL - 100 })
  assert.equal(await applyPayment(db, f.ports, a.id), "review")
  const b = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  approve(f, b.id, { status: "needs_review" })
  assert.equal(await applyPayment(db, f.ports, b.id), "review")
  await assert.rejects(fulfillOrder(db, f.ports, b.id, { kind: "staff", userId: "ana" }), isCode("invalid_status"))
})

test("rule 3: fulfil re-checks the payment (refunded → refused)", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  approve(f, o.id)
  assert.equal(await applyPayment(db, f.ports, o.id), "paid")
  f.payments.get(o.id)!.status = "refunded"
  await assert.rejects(fulfillOrder(db, f.ports, o.id, { kind: "staff", userId: "ana" }), isCode("payment_not_approved"))
  f.payments.get(o.id)!.status = "approved"
  const done = await fulfillOrder(db, f.ports, o.id, { kind: "staff", userId: "ana" })
  assert.equal(done.status, "fulfilled")
})

test("rule 4: concurrent cancels and expiries release the stock exactly once", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  const later = new Date(Date.now() + 60 * 60_000)
  const results = await Promise.all([
    ...Array.from({ length: 3 }, () =>
      releaseOrder(db, f.ports, o.id, { kind: "cancel", actor: { kind: "buyer", userId: "ana" }, asStaff: false })
    ),
    ...Array.from({ length: 3 }, () => releaseOrder(db, f.ports, o.id, { kind: "expire", now: later })),
  ])
  assert.equal(results.filter((r) => r === "canceled" || r === "expired").length, 1)
  assert.deepEqual(f.calls.release, [`order:${o.id}`])
  await assert.rejects(sql`update orders_orders set stock_released_at = now() where id = ${o.id}`.execute(db))
})

test("rule 4: a paid order is never released (code and database)", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  approve(f, o.id)
  // payment approved but not applied yet: expiry finds it and pays instead of releasing
  assert.equal(await releaseOrder(db, f.ports, o.id, { kind: "expire", now: new Date(Date.now() + 3_600_000) }), "paid")
  assert.equal(
    await releaseOrder(db, f.ports, o.id, { kind: "cancel", actor: { kind: "staff", userId: "ana" }, asStaff: true }),
    "skipped"
  )
  assert.deepEqual(f.calls.release, [])
  await assert.rejects(
    sql`update orders_orders set status = 'canceled', stock_released_at = now(), closed_at = now() where id = ${o.id}`.execute(db)
  )
})

test("rule 5: the sweep cancels the open checkout, expires and releases; a second run finds nothing", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  const r = await startOrderPayment(db, f.ports, o.id, { userId: "ana", ttlMinutes: 30, description: "Pedido" })
  assert.equal(r.kind, "redirect")
  const later = new Date(Date.now() + 2 * 3_600_000)
  const first = await expireDueOrders(db, f.ports, { now: later })
  assert.ok(first.expired >= 1)
  assert.equal(f.calls.cancelPayment, 1)
  assert.deepEqual(f.calls.release, [`order:${o.id}`])
  const second = await expireDueOrders(db, f.ports, { now: later })
  assert.equal(second.expired, 0)
  assert.deepEqual(f.calls.release, [`order:${o.id}`])
  const detail = await getOrderDetail(db, o.id)
  assert.equal(detail!.status, "expired")
  assert.equal(detail!.history.at(-1)!.actorKind, "system")
})

test("rule 6: history keeps the author of each change", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  await releaseOrder(db, f.ports, o.id, { kind: "cancel", actor: { kind: "buyer", userId: "ana" }, asStaff: false })
  const h = (await getOrderDetail(db, o.id))!.history
  assert.deepEqual(
    h.map((x) => [x.fromStatus, x.toStatus, x.actorKind, x.actorId]),
    [
      [null, "pending", "buyer", "ana"],
      ["pending", "canceled", "buyer", "ana"],
    ]
  )
})

test("discount hook: before the checkout only; amounts frozen after pending", { skip }, async () => {
  const f = fakes()
  const o = await createOrder(db, f.ports, { userId: "ana", cart: CART, ttlMinutes: 30 })
  const d = await applyOrderDiscount(db, f.ports, o.id, { amountMinor: 1000, code: "VERANO10", ref: "discount:1" })
  assert.equal(d.totalMinor, TOTAL - 1000)
  await assert.rejects(
    applyOrderDiscount(db, f.ports, o.id, { amountMinor: TOTAL, code: "TODO", ref: null }),
    isCode("invalid_discount")
  )
  await startOrderPayment(db, f.ports, o.id, { userId: "ana", ttlMinutes: 30, description: "Pedido" })
  assert.equal(f.payments.get(o.id)!.amountMinor, TOTAL - 1000)
  await assert.rejects(
    applyOrderDiscount(db, f.ports, o.id, { amountMinor: 2000, code: "OTRO", ref: null }),
    isCode("payment_started")
  )
  approve(f, o.id, { amountMinor: TOTAL - 1000 })
  assert.equal(await applyPayment(db, f.ports, o.id), "paid")
  await assert.rejects(sql`update orders_orders set total_minor = 1, discount_minor = subtotal_minor - 1 where id = ${o.id}`.execute(db))
})
