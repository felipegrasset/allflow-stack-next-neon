/**
 * Every write that uses, replaces, removes or releases a code on an order.
 * The money rules (MODULE.md) and how each one is held:
 *
 * 1. The amount is computed HERE from the STORED order (`ports.getOrder`),
 *    with the pure `applyDiscount`; the browser only sends a code.
 * 3. Caps: the code's row is locked (`select … for update`) before counting
 *    its active uses, in the same transaction that inserts the use; the
 *    database trigger `discounts_enforce_caps` does the same lock + count on
 *    every insert, as a backstop. Two concurrent redemptions of the last use:
 *    the second waits for the lock, sees the first one's use, and fails.
 * 4. One use per order: an advisory lock per order serialises everything this
 *    module does on one order, and a partial unique index allows one active
 *    use per order. Replacing = release the old use + insert the new one +
 *    write the new amount on the order, in ONE transaction.
 * 5. The use and orders' `applyOrderDiscount` run in the SAME transaction
 *    (`{ db: trx }`): if orders refuses (payment started, expired…), the use
 *    is rolled back too.
 *
 * Lock order, always: order key (advisory) → code row → order row (inside
 * orders' hook). Releasing never locks a code row, so no cycle.
 * No database error is caught inside a transaction (it would be aborted):
 * errors propagate, the transaction rolls back, and `toDiscountError` maps
 * them outside.
 */
import { randomUUID } from "node:crypto"

import { sql } from "kysely"

import { OrderError, type OrderActor } from "@/modules/orders/contracts/types"

import {
  applyDiscount,
  capErrorFromMessage,
  discountRefOf,
  isCapReached,
  normalizeCode,
  orderErrorToDiscount,
  rejectionError,
  releaseDecision,
} from "../contracts/domain"
import {
  DiscountError,
  type DiscountErrorCode,
  type ReleaseOutcome,
  type ReleaseReason,
  type SweepReport,
  type UsageSnapshot,
} from "../contracts/types"
import type { DiscountsPorts, OrderView } from "./ports"
import { toCode, toRedemption, type Db } from "./store"

/** Runs `fn` in the caller's transaction if `db` is one, else in a new one. */
function tx<T>(db: Db, fn: (trx: Db) => Promise<T>): Promise<T> {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn)
}

/** Serialises this module's writes on one order (released at commit/rollback). */
async function lockOrderKey(trx: Db, orderId: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`discounts:order:${orderId}`}, 0))`.execute(trx)
}

async function lockActiveRedemption(trx: Db, orderId: string) {
  const r = await trx
    .selectFrom("discounts_redemptions")
    .selectAll()
    .where("order_id", "=", orderId)
    .where("released_at", "is", null)
    .forUpdate()
    .executeTakeFirst()
  return r ? toRedemption(r) : null
}

/** Marks a use released (only if still active: safe against a concurrent release). */
async function release(trx: Db, redemptionId: string, reason: ReleaseReason, now: Date): Promise<boolean> {
  const r = await trx
    .updateTable("discounts_redemptions")
    .set({ released_at: now, release_reason: reason })
    .where("id", "=", redemptionId)
    .where("released_at", "is", null)
    .executeTakeFirst()
  return Number(r.numUpdatedRows) > 0
}

async function confirm(trx: Db, redemptionId: string, now: Date): Promise<void> {
  await trx
    .updateTable("discounts_redemptions")
    .set({ confirmed_at: now, checked_at: now })
    .where("id", "=", redemptionId)
    .where("released_at", "is", null)
    .where("confirmed_at", "is", null)
    .execute()
}

/** Active uses of a code, total and by one person. Call it with the code row locked. */
async function usageOf(trx: Db, codeId: string, userId: string): Promise<UsageSnapshot> {
  const row = await trx
    .selectFrom("discounts_redemptions")
    .select([
      sql<string>`count(*)`.as("total"),
      sql<string>`count(*) filter (where user_id = ${userId})`.as("mine"),
    ])
    .where("code_id", "=", codeId)
    .where("released_at", "is", null)
    .executeTakeFirst()
  return { usesTotal: Number(row?.total ?? 0), usesByUser: Number(row?.mine ?? 0) }
}

/**
 * When a code looks exhausted, some of its uses may belong to orders that
 * were canceled or expired and not swept yet: release those (at most `limit`,
 * one by one, inside this transaction) so a stale use never blocks a real one.
 */
async function reclaimStale(trx: Db, ports: DiscountsPorts, codeId: string, skipOrderId: string, now: Date, limit = 20) {
  const rows = await trx
    .selectFrom("discounts_redemptions")
    .select(["id", "order_id"])
    .where("code_id", "=", codeId)
    .where("released_at", "is", null)
    .where("confirmed_at", "is", null)
    .where("order_id", "<>", skipOrderId)
    .orderBy("created_at", "asc")
    .limit(limit)
    .execute()
  for (const r of rows) {
    const o = await ports.getOrder(r.order_id, trx)
    const d = releaseDecision(o?.status ?? null)
    if (d.action === "release") await release(trx, r.id, d.reason, now)
    else if (d.action === "confirm") await confirm(trx, r.id, now)
  }
}

/** The order of THIS buyer, still pending and not past its expiry; else the error to show. */
function checkOrder(order: OrderView | null, userId: string, now: Date): OrderView {
  if (!order || order.userId !== userId) throw new DiscountError("order_not_found")
  if (order.status !== "pending") throw new DiscountError("order_not_pending")
  if (order.expiresAt.getTime() <= now.getTime()) throw new DiscountError("order_expired")
  return order
}

const buyer = (userId: string): OrderActor => ({ kind: "buyer", userId })

export type RedeemResult = {
  order: OrderView
  code: string
  amountMinor: number
  /** It was already the order's code: nothing changed. */
  unchanged: boolean
  /** Another code was on the order and was replaced. */
  replaced: boolean
}

/**
 * Applies a typed code to the buyer's own pending order. Throws
 * `DiscountError` (use `toDiscountError` on anything else).
 */
export async function redeemCode(
  db: Db,
  ports: DiscountsPorts,
  input: { orderId: string; userId: string; code: string; now?: Date }
): Promise<RedeemResult> {
  const code = normalizeCode(input.code)
  if (!code) throw new DiscountError("invalid_code")
  const now = input.now ?? new Date()
  return tx(db, async (trx) => {
    await lockOrderKey(trx, input.orderId)
    const order = checkOrder(await ports.getOrder(input.orderId, trx), input.userId, now)

    const row = await trx.selectFrom("discounts_codes").selectAll().where("code", "=", code).forUpdate().executeTakeFirst()
    if (!row) throw new DiscountError("invalid_code")
    const rule = toCode(row)

    const current = await lockActiveRedemption(trx, order.id)
    if (current && current.codeId === rule.id)
      return { order, code: rule.code, amountMinor: current.amountMinor, unchanged: true, replaced: false }

    let usage = await usageOf(trx, rule.id, order.userId)
    if (rule.active && isCapReached(rule, usage)) {
      await reclaimStale(trx, ports, rule.id, order.id, now)
      usage = await usageOf(trx, rule.id, order.userId)
    }
    const result = applyDiscount(rule, order, { now, usage })
    if (!result.ok) throw new DiscountError(rejectionError(result.reason))

    if (current) await release(trx, current.id, "replaced", now)
    await trx
      .insertInto("discounts_redemptions")
      .values({
        id: randomUUID(),
        code_id: rule.id,
        code: rule.code,
        order_id: order.id,
        user_id: order.userId,
        amount_minor: result.amountMinor,
        currency: order.currency,
        subtotal_minor: order.subtotalMinor,
        created_at: now,
      })
      .execute()
    const fresh = await ports.applyOrderDiscount(
      order.id,
      { amountMinor: result.amountMinor, code: rule.code, ref: discountRefOf(rule.id) },
      trx,
      buyer(input.userId)
    )
    return { order: fresh, code: rule.code, amountMinor: result.amountMinor, unchanged: false, replaced: Boolean(current) }
  })
}

/** Removes the discount of the buyer's own pending order and frees its use. */
export async function removeDiscount(
  db: Db,
  ports: DiscountsPorts,
  input: { orderId: string; userId: string; now?: Date }
): Promise<OrderView> {
  const now = input.now ?? new Date()
  return tx(db, async (trx) => {
    await lockOrderKey(trx, input.orderId)
    const order = checkOrder(await ports.getOrder(input.orderId, trx), input.userId, now)
    const current = await lockActiveRedemption(trx, order.id)
    if (!current && order.discountMinor === 0) throw new DiscountError("nothing_to_remove")
    if (current) await release(trx, current.id, "removed", now)
    return ports.applyOrderDiscount(order.id, { amountMinor: 0, code: null, ref: null }, trx, buyer(input.userId))
  })
}

/**
 * Frees the use of a canceled / expired (or deleted) order; confirms it for a
 * paid / fulfilled one; keeps it while the order is pending or in review.
 * Idempotent and safe in parallel (advisory lock per order + conditional
 * updates). Needs no session.
 */
export async function releaseForOrder(
  db: Db,
  ports: DiscountsPorts,
  orderId: string,
  opts: { now?: Date } = {}
): Promise<ReleaseOutcome> {
  const now = opts.now ?? new Date()
  return tx(db, async (trx) => {
    await lockOrderKey(trx, orderId)
    const current = await lockActiveRedemption(trx, orderId)
    if (!current) return { kind: "none" }
    const order = await ports.getOrder(orderId, trx)
    const d = releaseDecision(order?.status ?? null)
    if (d.action === "release") {
      await release(trx, current.id, d.reason, now)
      return { kind: "released", reason: d.reason }
    }
    if (d.action === "confirm") {
      if (!current.confirmedAt) await confirm(trx, current.id, now)
      return { kind: "confirmed" }
    }
    await trx.updateTable("discounts_redemptions").set({ checked_at: now }).where("id", "=", current.id).execute()
    return { kind: "kept" }
  })
}

/**
 * The sweep: looks at active, unconfirmed uses (least recently checked first)
 * and applies `releaseForOrder` to each, one transaction per order. Run it
 * right after orders' `expirePendingOrders()` in the same scheduled task.
 */
export async function sweepStale(
  db: Db,
  ports: DiscountsPorts,
  opts: { limit?: number; now?: Date } = {}
): Promise<SweepReport> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000)
  const rows = await db
    .selectFrom("discounts_redemptions")
    .select("order_id")
    .where("released_at", "is", null)
    .where("confirmed_at", "is", null)
    .orderBy(sql`coalesce(checked_at, created_at)`, "asc")
    .limit(limit)
    .execute()
  const report: SweepReport = { checked: 0, released: 0, confirmed: 0, kept: 0, failed: 0 }
  for (const r of rows) {
    report.checked++
    try {
      const out = await releaseForOrder(db, ports, r.order_id, { now: opts.now })
      if (out.kind === "released") report.released++
      else if (out.kind === "confirmed") report.confirmed++
      else if (out.kind === "kept") report.kept++
    } catch (e) {
      report.failed++
      console.error("[discounts] sweep failed for one order", e instanceof Error ? e.name : "error")
    }
  }
  return report
}

/**
 * Anything thrown by redeem/remove → a code for the UI. orders' `OrderError`
 * and the database trigger's cap errors are translated; the rest is `unknown`.
 */
export function toDiscountError(err: unknown): DiscountErrorCode {
  if (err instanceof DiscountError) return err.code
  if (err instanceof OrderError) return orderErrorToDiscount(err.code)
  if (err instanceof Error) return capErrorFromMessage(err.message) ?? "unknown"
  return "unknown"
}
