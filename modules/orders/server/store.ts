/**
 * Reads of `orders` and the row mappers. Writes that change a status live in
 * server/lifecycle.ts (always under a row lock).
 */
import type { Kysely, Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import type {
  ActorKind,
  Order,
  OrderDetail,
  OrderHistoryEntry,
  OrderItem,
  OrderStatus,
} from "../contracts/types"
import type { OrdersItemsTable, OrdersOrdersTable, OrdersStatusHistoryTable } from "../db/types"

import "../db/types"

export type Db = Kysely<Database>

/** bigint (string) → number, refusing anything that is not a safe integer. */
export function money(v: string | number): number {
  const n = Number(v)
  if (!Number.isSafeInteger(n)) throw new Error("orders: monto fuera de rango")
  return n
}

export function toOrder(r: Selectable<OrdersOrdersTable>): Order {
  return {
    id: r.id,
    userId: r.user_id,
    status: r.status as OrderStatus,
    currency: r.currency.trim(),
    subtotalMinor: money(r.subtotal_minor),
    discountMinor: money(r.discount_minor),
    totalMinor: money(r.total_minor),
    discountCode: r.discount_code,
    discountRef: r.discount_ref,
    stockRef: r.stock_ref,
    paymentId: r.payment_id,
    expiresAt: r.expires_at,
    paidAt: r.paid_at,
    fulfilledAt: r.fulfilled_at,
    closedAt: r.closed_at,
    stockReleasedAt: r.stock_released_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function toItem(r: Selectable<OrdersItemsTable>): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    position: r.position,
    itemId: r.item_id,
    name: r.name,
    sku: r.sku,
    unitPriceMinor: money(r.unit_price_minor),
    qty: r.qty,
    lineTotalMinor: money(r.line_total_minor),
  }
}

export function toHistory(r: Selectable<OrdersStatusHistoryTable>): OrderHistoryEntry {
  return {
    id: r.id,
    orderId: r.order_id,
    fromStatus: (r.from_status as OrderStatus | null) ?? null,
    toStatus: r.to_status as OrderStatus,
    actorKind: r.actor_kind as ActorKind,
    actorId: r.actor_id,
    note: r.note,
    createdAt: r.created_at,
  }
}

export async function getOrder(db: Db, id: string): Promise<Order | null> {
  const row = await db.selectFrom("orders_orders").selectAll().where("id", "=", id).executeTakeFirst()
  return row ? toOrder(row) : null
}

/** Locks the order row (`for update`). Must run inside a transaction. */
export async function lockOrder(trx: Db, id: string): Promise<Order | null> {
  const row = await trx.selectFrom("orders_orders").selectAll().where("id", "=", id).forUpdate().executeTakeFirst()
  return row ? toOrder(row) : null
}

export async function getOrderDetail(db: Db, id: string): Promise<OrderDetail | null> {
  const order = await getOrder(db, id)
  if (!order) return null
  const [items, history] = await Promise.all([
    db.selectFrom("orders_items").selectAll().where("order_id", "=", id).orderBy("position", "asc").execute(),
    db
      .selectFrom("orders_status_history")
      .selectAll()
      .where("order_id", "=", id)
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute(),
  ])
  return { ...order, items: items.map(toItem), history: history.map(toHistory) }
}

export const LIST_LIMIT = 100

/** The person's own orders, newest first. */
export async function listOrdersForUser(db: Db, userId: string, limit = LIST_LIMIT): Promise<Order[]> {
  const rows = await db
    .selectFrom("orders_orders")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(Math.min(Math.max(limit, 1), LIST_LIMIT))
    .execute()
  return rows.map(toOrder)
}

export type AdminOrderRow = Order & { buyerEmail: string | null; buyerName: string | null }

/** Every order (staff), newest first, optionally by status, with the buyer's name and email. */
export async function listAllOrders(
  db: Db,
  opts: { status?: OrderStatus; limit?: number } = {}
): Promise<AdminOrderRow[]> {
  let q = db
    .selectFrom("orders_orders as o")
    .leftJoin("user as u", "u.id", "o.user_id")
    .selectAll("o")
    .select(["u.email as buyer_email", "u.name as buyer_name"])
  if (opts.status) q = q.where("o.status", "=", opts.status)
  const rows = await q
    .orderBy("o.created_at", "desc")
    .orderBy("o.id", "desc")
    .limit(Math.min(Math.max(opts.limit ?? LIST_LIMIT, 1), LIST_LIMIT))
    .execute()
  return rows.map(({ buyer_email, buyer_name, ...r }) => ({
    ...toOrder(r),
    buyerEmail: buyer_email ?? null,
    buyerName: buyer_name ?? null,
  }))
}

/** Ids of pending orders whose time is up, oldest due first. */
export async function listDuePendingIds(db: Db, now: Date, limit: number): Promise<string[]> {
  const rows = await db
    .selectFrom("orders_orders")
    .select("id")
    .where("status", "=", "pending")
    .where("expires_at", "<=", now)
    .orderBy("expires_at", "asc")
    .limit(Math.min(Math.max(limit, 1), 500))
    .execute()
  return rows.map((r) => r.id)
}
