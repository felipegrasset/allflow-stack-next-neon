/**
 * The only thing another module may import from `orders` (server side). Pure
 * pieces (types, rules, schemas) are re-exported too; a client component
 * imports them from `@/modules/orders/contracts/types` / `/domain`, and the
 * add-to-cart button from `@/modules/orders/contracts/ui`.
 *
 *   import { applyOrderDiscount, expirePendingOrders, getOrder } from "@/modules/orders/contracts"
 *
 * None of these check session or permission: they are for server code that
 * already checked its own (an action, a job, a webhook).
 */
import type { Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"

import { ordersTtlMinutes } from "../server/config"
import * as lifecycle from "../server/lifecycle"
import { defaultPorts } from "../server/ports"
import * as store from "../server/store"
import type { OrderDiscountInput } from "./input"
import type { CartLine, ExpireReport, Order, OrderActor, OrderDetail } from "./types"

/** Optional executor: pass your transaction (`trx`) to run inside it. */
export type OrdersDbOptions = { db?: Kysely<Database> }
const dbOf = (opts?: OrdersDbOptions) => opts?.db ?? getKysely()

export const getOrder = (orderId: string, opts?: OrdersDbOptions): Promise<Order | null> =>
  store.getOrder(dbOf(opts), orderId)

/** The order with its line photos and its status history. */
export const getOrderDetail = (orderId: string, opts?: OrdersDbOptions): Promise<OrderDetail | null> =>
  store.getOrderDetail(dbOf(opts), orderId)

/** A person's orders, newest first (max 100). */
export const listOrdersForUser = (userId: string, opts?: OrdersDbOptions): Promise<Order[]> =>
  store.listOrdersForUser(dbOf(opts), userId)

/**
 * Creates a pending order for `userId` from ids + quantities, pricing it from
 * catalog and reserving stock in one transaction. Throws `OrderError`.
 */
export const createOrder = (
  input: { userId: string; cart: readonly CartLine[]; expected?: { subtotalMinor: number; currency: string } },
  opts?: OrdersDbOptions
): Promise<Order> => lifecycle.createOrder(dbOf(opts), defaultPorts, { ...input, ttlMinutes: ordersTtlMinutes() })

/**
 * THE DISCOUNT HOOK. Writes a discount that YOUR server code computed
 * (`amountMinor` in the order's currency minor unit, `code`, `ref`) on a
 * pending order BEFORE its checkout starts. total = subtotal − discount ≥ 1.
 * Throws `OrderError`: `invalid_discount`, `invalid_status`, `expired`,
 * `payment_started`, `not_found`. `{ amountMinor: 0, code: null, ref: null }`
 * removes it. Pass `{ db: trx }` to commit it together with your own rows
 * (e.g. a code's usage count).
 */
export const applyOrderDiscount = (
  orderId: string,
  input: OrderDiscountInput,
  opts?: OrdersDbOptions & { actor?: OrderActor }
): Promise<Order> => lifecycle.applyOrderDiscount(dbOf(opts), defaultPorts, orderId, input, { actor: opts?.actor })

/**
 * Applies what payments knows (`getPaymentByOrder`) to the order: approved
 * with the stored amount → `paid` (idempotent, notifies once); needs_review /
 * refunded / amount mismatch → `review`. Reads the database only.
 */
export const applyOrderPayment = (orderId: string) => lifecycle.applyPayment(getKysely(), defaultPorts, orderId)

/** Cancels an order (stock released once). `asStaff` also allows `review`. Never a paid order. */
export const cancelOrder = (orderId: string, actor: OrderActor, opts: { asStaff: boolean; note?: string | null }) =>
  lifecycle.releaseOrder(getKysely(), defaultPorts, orderId, { kind: "cancel", actor, ...opts })

/** paid → fulfilled, re-checking that the payment is still approved for the stored amount. */
export const fulfillOrder = (orderId: string, actor: OrderActor) =>
  lifecycle.fulfillOrder(getKysely(), defaultPorts, orderId, actor)

/**
 * Expires every pending order past `expires_at` (ORDERS_PENDING_TTL_MINUTES),
 * giving its stock back exactly once. Idempotent; safe to run concurrently.
 * Call it from a scheduled task (see MODULE.md: `jobs` or the built-in
 * `/api/orders/expire` route). `sync` (default true) asks the provider about
 * open payments first.
 */
export const expirePendingOrders = (opts?: { now?: Date; limit?: number; sync?: boolean }): Promise<ExpireReport> =>
  lifecycle.expireDueOrders(getKysely(), defaultPorts, opts)

/** Path of an order's page. */
export const orderPath = (orderId: string) => `/orders/${orderId}`
export const CART_PATH = "/carrito"
export const CHECKOUT_PATH = "/checkout"

export {
  canCancel,
  canTransition,
  decidePayment,
  isOrderId,
  normalizeCart,
  quoteCart,
  shortOrderRef,
  stockRefOf,
  totalAfterDiscount,
} from "./domain"
export { orderDiscountSchema, type OrderDiscountInput } from "./input"
export * from "./types"
