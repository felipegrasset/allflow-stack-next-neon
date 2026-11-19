/**
 * What discounts needs from `orders`, behind a small interface so the redeem
 * logic (server/redeem.ts) can be driven by fakes in the database tests. The
 * defaults call orders' `contracts/` (the only thing a module may import from
 * another).
 */
import type { Kysely } from "kysely"

import { applyOrderDiscount, getOrder, type Order, type OrderActor } from "@/modules/orders/contracts"
import type { Database } from "@/server/db/schema"

type Db = Kysely<Database>

/** The fields of an order this module reads. */
export type OrderView = Pick<Order, "id" | "userId" | "status" | "currency" | "subtotalMinor" | "discountMinor" | "totalMinor" | "discountCode" | "expiresAt">

export type DiscountsPorts = {
  /** Reads the order (inside `db` when it is a transaction). */
  getOrder(orderId: string, db: Db): Promise<OrderView | null>
  /**
   * orders' discount hook, run INSIDE our transaction (`db` is the `trx`), so
   * the use and the order's amounts commit or roll back together. Throws
   * orders' `OrderError` (invalid_status, expired, payment_started,
   * invalid_discount, not_found).
   */
  applyOrderDiscount(
    orderId: string,
    input: { amountMinor: number; code: string | null; ref: string | null },
    db: Db,
    actor: OrderActor
  ): Promise<OrderView>
}

export const defaultPorts: DiscountsPorts = {
  getOrder: (orderId, db) => getOrder(orderId, { db }),
  applyOrderDiscount: (orderId, input, db, actor) => applyOrderDiscount(orderId, input, { db, actor }),
}
