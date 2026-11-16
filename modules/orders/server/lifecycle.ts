/**
 * Every write that creates an order or changes its status. The rules:
 *
 * 1. The total is computed HERE from catalog, inside the order's transaction,
 *    after `reserveStock` locked the item rows (so the prices read are the
 *    prices at that instant). The browser sends ids and quantities only.
 * 2. Each line is stored as a photo (name, sku, unit price, qty, line total).
 * 3. "paid" only when payments says `approved` for THIS order with amount and
 *    currency equal to the stored total; atomic and idempotent (row lock +
 *    `where status = <from>` + the database trigger on transitions).
 * 4. Stock is released in the SAME transaction that moves the order to
 *    canceled/expired, so it happens exactly once; paid orders never get there
 *    (transition table + trigger).
 * 5. Every status change writes `orders_status_history` with its author.
 *
 * All functions take the database and the ports (server/ports.ts) so the DB
 * tests can run them with fakes.
 */
import { randomUUID } from "node:crypto"

import { sql } from "kysely"

import {
  canTransition,
  decidePayment,
  isOrderId,
  paymentTarget,
  planCancel,
  planExpiry,
  quoteCart,
  releasesStock,
  stockRefOf,
  totalAfterDiscount,
  normalizeCart,
  type ExpiryPlan,
} from "../contracts/domain"
import { orderDiscountSchema, type OrderDiscountInput } from "../contracts/input"
import {
  OrderError,
  SYSTEM_ACTOR,
  type CartLine,
  type ExpireReport,
  type Order,
  type OrderActor,
  type OrderStatus,
  type PaymentView,
} from "../contracts/types"
import type { OrdersPorts } from "./ports"
import { lockOrder, getOrder, listDuePendingIds, type Db } from "./store"

const errName = (e: unknown) => (e instanceof Error ? e.name : "error")

/**
 * catalog's StockError, recognised by shape (name + code) so this file needs
 * no runtime import of catalog and the DB tests can drive it with fakes.
 */
const isStockError = (e: unknown): e is { code: string; itemId?: string } =>
  e instanceof Error && e.name === "StockError" && typeof (e as { code?: unknown }).code === "string"

/** Runs `fn` in the caller's transaction if `db` is one, else in a new one. */
function tx<T>(db: Db, fn: (trx: Db) => Promise<T>): Promise<T> {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn)
}

async function writeHistory(
  trx: Db,
  orderId: string,
  from: OrderStatus | null,
  to: OrderStatus,
  actor: OrderActor,
  note: string | null
): Promise<void> {
  await trx
    .insertInto("orders_status_history")
    .values({
      id: randomUUID(),
      order_id: orderId,
      from_status: from,
      to_status: to,
      actor_kind: actor.kind,
      actor_id: actor.kind === "system" ? null : actor.userId,
      note: note ? note.slice(0, 300) : null,
    })
    .execute()
}

/**
 * Moves a LOCKED order from its status to `to`. Releases stock in the same
 * transaction when `to` is canceled/expired. Throws (rolling everything back)
 * if the transition is not allowed or someone moved it meanwhile.
 */
async function transition(
  trx: Db,
  ports: OrdersPorts,
  order: Order,
  to: OrderStatus,
  actor: OrderActor,
  extra: { paymentId?: string; note?: string | null } = {}
): Promise<void> {
  if (!canTransition(order.status, to)) throw new OrderError("invalid_status", `orders: ${order.status} -> ${to}`)
  const now = new Date()
  if (releasesStock(to)) {
    await ports.releaseStock(
      { ref: order.stockRef, createdBy: actor.userId, note: to === "expired" ? "order expired" : "order canceled" },
      { db: trx }
    )
  }
  const res = await trx
    .updateTable("orders_orders")
    .set({
      status: to,
      updated_at: now,
      ...(to === "paid" ? { paid_at: now, payment_id: extra.paymentId ?? order.paymentId } : {}),
      ...(to === "fulfilled" ? { fulfilled_at: now } : {}),
      ...(releasesStock(to) ? { closed_at: now, stock_released_at: now } : {}),
    })
    .where("id", "=", order.id)
    .where("status", "=", order.status)
    .executeTakeFirst()
  if (Number(res.numUpdatedRows) !== 1) throw new OrderError("invalid_status", "orders: el pedido cambió mientras tanto")
  await writeHistory(trx, order.id, order.status, to, actor, extra.note ?? null)
}

// ── create ───────────────────────────────────────────────────────────────────

export type CreateOrderInput = {
  userId: string
  cart: readonly CartLine[]
  /** What the person confirmed (subtotal + currency). Only compared, never charged. */
  expected?: { subtotalMinor: number; currency: string }
  now?: Date
  ttlMinutes: number
}

/**
 * Creates a pending order with its stock reserved, all or nothing. Throws
 * OrderError: `empty_cart`, `invalid_input`, `unavailable`, `insufficient_stock`
 * (with `itemIds`), `mixed_currency`, `zero_total`, `too_large`, `prices_changed`.
 */
export async function createOrder(db: Db, ports: OrdersPorts, input: CreateOrderInput): Promise<Order> {
  const cart = normalizeCart(input.cart)
  if (cart.length === 0) throw new OrderError("empty_cart")
  const now = input.now ?? new Date()
  const id = randomUUID()
  const ref = stockRefOf(id)

  const created = await tx(db, async (trx) => {
    // 1) Stock first: it locks the item rows (id order) until commit, so the
    //    prices read next cannot change under us.
    try {
      await ports.reserveStock({ ref, lines: cart, createdBy: input.userId }, { db: trx })
    } catch (e) {
      if (isStockError(e)) {
        const ids = e.itemId ? [e.itemId] : []
        if (e.code === "insufficient_stock") throw new OrderError("insufficient_stock", undefined, ids)
        if (e.code === "item_not_found" || e.code === "item_unavailable")
          throw new OrderError("unavailable", undefined, ids)
        throw new OrderError("invalid_input")
      }
      throw e
    }
    // 2) Prices from catalog, under the lock.
    const items = await ports.getSellableItems(
      cart.map((l) => l.itemId),
      { db: trx }
    )
    const q = quoteCart(cart, items)
    if (!q.ok) {
      if (q.reason === "unavailable") throw new OrderError("unavailable", undefined, q.itemIds)
      if (q.reason === "mixed_currency") throw new OrderError("mixed_currency")
      if (q.reason === "empty") throw new OrderError("empty_cart")
      throw new OrderError("too_large")
    }
    const { quote } = q
    if (quote.subtotalMinor < 1) throw new OrderError("zero_total")
    if (
      input.expected &&
      (input.expected.subtotalMinor !== quote.subtotalMinor || input.expected.currency !== quote.currency)
    )
      throw new OrderError("prices_changed")

    // 3) The order and the photo of its lines.
    await trx
      .insertInto("orders_orders")
      .values({
        id,
        user_id: input.userId,
        status: "pending",
        currency: quote.currency,
        subtotal_minor: quote.subtotalMinor,
        discount_minor: 0,
        total_minor: quote.subtotalMinor,
        stock_ref: ref,
        expires_at: new Date(now.getTime() + input.ttlMinutes * 60_000),
      })
      .execute()
    await trx
      .insertInto("orders_items")
      .values(
        quote.lines.map((l, position) => ({
          id: randomUUID(),
          order_id: id,
          position,
          item_id: l.itemId,
          name: l.name.slice(0, 200),
          sku: l.sku,
          unit_price_minor: l.unitPriceMinor,
          qty: l.qty,
          line_total_minor: l.lineTotalMinor,
        }))
      )
      .execute()
    await writeHistory(trx, id, null, "pending", { kind: "buyer", userId: input.userId }, null)
    return lockOrder(trx, id)
  })
  if (!created) throw new OrderError("not_found")
  return created
}

// ── payment → paid / review ──────────────────────────────────────────────────

export type PaymentOutcome = "paid" | "already_paid" | "review" | "unchanged" | "not_found"

/**
 * Reads the payment (payments' own table, through its contract) and applies
 * it to the order under a row lock. Idempotent: a second call sees `paid` and
 * answers `already_paid` without writing. Notifies after commit.
 */
export async function applyPayment(
  db: Db,
  ports: OrdersPorts,
  orderId: string,
  actor: OrderActor = SYSTEM_ACTOR
): Promise<PaymentOutcome> {
  if (!isOrderId(orderId)) return "not_found"
  const result = await tx(db, async (trx) => {
    const order = await lockOrder(trx, orderId)
    if (!order) return { outcome: "not_found" as const }
    if (order.status === "paid" || order.status === "fulfilled") return { outcome: "already_paid" as const }
    const payment = await ports.getPaymentByOrder(orderId)
    const target = paymentTarget(order.status, decidePayment(order, payment))
    if (!target || !payment) return { outcome: "unchanged" as const }
    await transition(trx, ports, order, target, actor, {
      paymentId: payment.id,
      note: target === "paid" ? "payment approved" : `payment ${payment.status}`,
    })
    return { outcome: target, order: { ...order, status: target } }
  })
  if (result.outcome === "paid" && "order" in result && result.order) await ports.onPaid(result.order)
  return result.outcome
}

// ── release: expire / cancel ─────────────────────────────────────────────────

export type ReleaseOutcome = "expired" | "canceled" | "paid" | "review" | "not_due" | "skipped" | "not_found"

/**
 * Expires (system, clock) or cancels (buyer/staff) an order. Under the row
 * lock it reads the payment first: an approved one turns the order paid
 * instead; an open one is cancelled in payments before giving stock back; if
 * payments refuses to cancel (it was just approved), it reads again and
 * decides again. Stock is released in the same transaction as the status.
 */
export async function releaseOrder(
  db: Db,
  ports: OrdersPorts,
  orderId: string,
  mode: { kind: "expire"; now?: Date } | { kind: "cancel"; actor: OrderActor; asStaff: boolean; note?: string | null }
): Promise<ReleaseOutcome> {
  if (!isOrderId(orderId)) return "not_found"
  const result = await tx(db, async (trx) => {
    const order = await lockOrder(trx, orderId)
    if (!order) return { outcome: "not_found" as const }
    const plan = async (payment: PaymentView | null): Promise<ExpiryPlan> =>
      mode.kind === "expire"
        ? planExpiry(order, payment, mode.now ?? new Date())
        : planCancel(order, payment, mode.asStaff)

    let payment = await ports.getPaymentByOrder(orderId)
    let p = await plan(payment)
    if (p.action === "cancel_payment_then_release") {
      const canceled = await ports.cancelPayment(p.paymentId)
      if (!canceled) {
        // payments refused: the payment moved (approved, needs_review…). Decide again on fresh data.
        payment = await ports.getPaymentByOrder(orderId)
        p = await plan(payment)
        if (p.action === "cancel_payment_then_release") return { outcome: "skipped" as const }
      }
      else p = { action: "release" }
    }
    switch (p.action) {
      case "not_due":
        return { outcome: "not_due" as const }
      case "skip":
        return { outcome: "skipped" as const }
      case "to":
        await transition(trx, ports, order, p.status, SYSTEM_ACTOR, {
          paymentId: payment?.id,
          note: p.status === "paid" ? "payment approved" : `payment ${payment?.status ?? "unknown"}`,
        })
        return { outcome: p.status, order: { ...order, status: p.status } }
      case "release": {
        const to: "expired" | "canceled" = mode.kind === "expire" ? "expired" : "canceled"
        const actor = mode.kind === "expire" ? SYSTEM_ACTOR : mode.actor
        await transition(trx, ports, order, to, actor, { note: mode.kind === "cancel" ? (mode.note ?? null) : null })
        return { outcome: to }
      }
    }
  })
  if (result.outcome === "paid" && "order" in result && result.order) await ports.onPaid(result.order)
  return result.outcome
}

// ── fulfil ───────────────────────────────────────────────────────────────────

/**
 * paid → fulfilled (staff). Re-checks the payment at that moment: a payment
 * refunded or sent to review since then is NOT fulfilled (`payment_not_approved`).
 */
export async function fulfillOrder(db: Db, ports: OrdersPorts, orderId: string, actor: OrderActor): Promise<Order> {
  if (!isOrderId(orderId)) throw new OrderError("not_found")
  return tx(db, async (trx) => {
    const order = await lockOrder(trx, orderId)
    if (!order) throw new OrderError("not_found")
    if (order.status !== "paid") throw new OrderError("invalid_status")
    const payment = await ports.getPaymentByOrder(orderId)
    if (decidePayment(order, payment) !== "mark_paid") throw new OrderError("payment_not_approved")
    await transition(trx, ports, order, "fulfilled", actor)
    return { ...order, status: "fulfilled" }
  })
}

// ── discount hook (for the `discounts` module) ───────────────────────────────

/**
 * Writes a discount computed ON THE SERVER by another module, BEFORE any
 * checkout starts. Only on a `pending`, not-yet-expired order without an open
 * payment (a payment carries its amount; changing the total under it would
 * send the payment to review). The database trigger freezes amounts once the
 * order leaves `pending`. Leaves a history row (pending → pending) with the code.
 */
export async function applyOrderDiscount(
  db: Db,
  ports: OrdersPorts,
  orderId: string,
  input: OrderDiscountInput,
  opts: { actor?: OrderActor; now?: Date } = {}
): Promise<Order> {
  const parsed = orderDiscountSchema.safeParse(input)
  if (!parsed.success) throw new OrderError("invalid_discount")
  const d = parsed.data
  if (!isOrderId(orderId)) throw new OrderError("not_found")
  return tx(db, async (trx) => {
    const order = await lockOrder(trx, orderId)
    if (!order) throw new OrderError("not_found")
    if (order.status !== "pending") throw new OrderError("invalid_status")
    if (order.expiresAt.getTime() <= (opts.now ?? new Date()).getTime()) throw new OrderError("expired")
    const payment = await ports.getPaymentByOrder(orderId)
    if (payment && payment.status !== "canceled") throw new OrderError("payment_started")
    const total = totalAfterDiscount(order.subtotalMinor, d.amountMinor)
    if (total === null) throw new OrderError("invalid_discount")
    const none = d.amountMinor === 0
    await trx
      .updateTable("orders_orders")
      .set({
        discount_minor: d.amountMinor,
        total_minor: total,
        discount_code: none ? null : d.code,
        discount_ref: none ? null : d.ref,
        updated_at: new Date(),
      })
      .where("id", "=", orderId)
      .where("status", "=", "pending")
      .execute()
    await writeHistory(
      trx,
      orderId,
      "pending",
      "pending",
      opts.actor ?? SYSTEM_ACTOR,
      none ? "discount removed" : `discount ${d.code ?? d.ref ?? ""}: -${d.amountMinor}`
    )
    const fresh = await lockOrder(trx, orderId)
    if (!fresh) throw new OrderError("not_found")
    return fresh
  })
}

// ── pay ──────────────────────────────────────────────────────────────────────

export type StartPaymentResult = { kind: "redirect"; url: string } | { kind: "paid" } | { kind: "review" }

/**
 * Starts (or reuses) the checkout of the buyer's own order. The amount is the
 * total STORED on the order. Extends the expiry to now + TTL first, so the
 * expiry job does not cancel a checkout the person just opened. Throws
 * OrderError: `not_found` (not theirs), `invalid_status`, `expired`,
 * `payment_conflict`.
 */
export async function startOrderPayment(
  db: Db,
  ports: OrdersPorts,
  orderId: string,
  opts: { userId: string; ttlMinutes: number; description: string; now?: Date }
): Promise<StartPaymentResult> {
  if (!isOrderId(orderId)) throw new OrderError("not_found")
  const now = opts.now ?? new Date()
  const order = await getOrder(db, orderId)
  if (!order || order.userId !== opts.userId) throw new OrderError("not_found")
  if (order.status === "paid" || order.status === "fulfilled") return { kind: "paid" }
  if (order.status === "review") return { kind: "review" }
  if (order.status !== "pending") throw new OrderError("invalid_status")
  if (order.expiresAt.getTime() <= now.getTime()) {
    const r = await releaseOrder(db, ports, orderId, { kind: "expire", now })
    if (r === "paid") return { kind: "paid" }
    if (r === "review") return { kind: "review" }
    throw new OrderError("expired")
  }
  const extended = await db
    .updateTable("orders_orders")
    .set({
      expires_at: sql<Date>`greatest(expires_at, ${new Date(now.getTime() + opts.ttlMinutes * 60_000)})`,
      updated_at: now,
    })
    .where("id", "=", orderId)
    .where("status", "=", "pending")
    .where("expires_at", ">", now)
    .executeTakeFirst()
  if (Number(extended.numUpdatedRows) !== 1) throw new OrderError("expired")

  const res = await ports.startCheckout({
    orderId,
    amountMinor: order.totalMinor,
    currency: order.currency,
    description: opts.description.slice(0, 200),
    returnPath: `/orders/${orderId}?pago=1`,
  })
  if (res.kind === "already_paid") {
    const r = await applyPayment(db, ports, orderId)
    if (r === "paid" || r === "already_paid") return { kind: "paid" }
    if (r === "review") return { kind: "review" }
    throw new OrderError("payment_conflict")
  }
  if (res.kind === "conflict") throw new OrderError("payment_conflict")
  await db
    .updateTable("orders_orders")
    .set({ payment_id: res.paymentId, updated_at: new Date() })
    .where("id", "=", orderId)
    .where("status", "=", "pending")
    .execute()
  return { kind: "redirect", url: res.url }
}

// ── reconcile (order page) and the expiry sweep ──────────────────────────────

/**
 * What the order page runs on each visit: optionally asks the provider
 * (rate limited by the caller), applies the payment, and expires the order if
 * its time is up. Never throws for a provider failure.
 */
export async function reconcileOrder(
  db: Db,
  ports: OrdersPorts,
  orderId: string,
  opts: { askProvider: boolean; now?: Date }
): Promise<void> {
  const order = await getOrder(db, orderId)
  if (!order || (order.status !== "pending" && order.status !== "review")) return
  if (opts.askProvider) {
    const payment = await ports.getPaymentByOrder(orderId)
    if (payment && (payment.status === "pending" || payment.status === "failed")) {
      try {
        await ports.syncPayment(payment.id)
      } catch (e) {
        console.error("[orders] sync failed", orderId, errName(e))
      }
    }
  }
  const r = await applyPayment(db, ports, orderId)
  if (r === "unchanged" && order.status === "pending" && order.expiresAt.getTime() <= (opts.now ?? new Date()).getTime())
    await releaseOrder(db, ports, orderId, { kind: "expire", now: opts.now })
}

/**
 * Expires every pending order whose time is up, giving its stock back.
 * Idempotent and safe to run concurrently (row locks; a second run finds
 * nothing due). With `sync`, an open payment is first checked with the
 * provider, so a payment approved whose webhook is late is not cancelled.
 */
export async function expireDueOrders(
  db: Db,
  ports: OrdersPorts,
  opts: { now?: Date; limit?: number; sync?: boolean } = {}
): Promise<ExpireReport> {
  const now = opts.now ?? new Date()
  const report: ExpireReport = { checked: 0, expired: 0, paid: 0, review: 0, skipped: 0, failed: 0 }
  const ids = await listDuePendingIds(db, now, opts.limit ?? 100)
  for (const id of ids) {
    report.checked++
    try {
      if (opts.sync !== false) {
        const payment = await ports.getPaymentByOrder(id)
        if (payment && (payment.status === "pending" || payment.status === "failed")) {
          try {
            await ports.syncPayment(payment.id)
          } catch (e) {
            console.error("[orders] expire: sync failed", id, errName(e))
          }
        }
      }
      const r = await releaseOrder(db, ports, id, { kind: "expire", now })
      if (r === "expired") report.expired++
      else if (r === "paid") report.paid++
      else if (r === "review") report.review++
      else report.skipped++
    } catch (e) {
      report.failed++
      console.error("[orders] expire failed", id, errName(e))
    }
  }
  return report
}
