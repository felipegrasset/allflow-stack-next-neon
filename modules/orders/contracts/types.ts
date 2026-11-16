/**
 * Types, constants and errors of `orders`. Pure: no server or client APIs, so
 * a server action, a client component, a test and another module (e.g.
 * `discounts`) can all import it.
 */

/**
 * - `pending`   — created, stock reserved, waiting for payment. Expires.
 * - `review`    — the payment needs a person (`needs_review` in payments, or an
 *                 approved amount that does not match the order). Never
 *                 fulfilled, never expired automatically; staff decides.
 * - `paid`      — `getPaymentByOrder(id).status === "approved"` and the amount
 *                 and currency match the stored total. Stock is never released.
 * - `fulfilled` — delivered by staff (only from `paid`, payment re-checked).
 * - `canceled`  — cancelled by the buyer or staff; stock released once.
 * - `expired`   — not paid in time; stock released once.
 */
export const ORDER_STATUSES = ["pending", "review", "paid", "fulfilled", "canceled", "expired"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Statuses whose stock has been given back (exactly once, in the same transaction). */
export const RELEASED_STATUSES = ["canceled", "expired"] as const satisfies readonly OrderStatus[]
/** Statuses that hold money: their stock is never released. */
export const PAID_STATUSES = ["paid", "fulfilled"] as const satisfies readonly OrderStatus[]

/** Who caused a status change (`orders_status_history.actor_kind`). */
export const ACTOR_KINDS = ["buyer", "staff", "system"] as const
export type ActorKind = (typeof ACTOR_KINDS)[number]

/** `actorId` null only for `system` (expiry job, payment reconciliation without a session). */
export type OrderActor = { kind: ActorKind; userId: string | null }
export const SYSTEM_ACTOR: OrderActor = { kind: "system", userId: null }

/** Largest quantity of one line in a cart/order. */
export const MAX_LINE_QTY = 999
/** Most distinct items in a cart/order. */
export const MAX_CART_LINES = 50

/** One cart line: ONLY an id and a quantity. Prices never come from the browser. */
export type CartLine = { itemId: string; qty: number }

/** A priced line, computed on the server from `catalog`. */
export type QuotedLine = {
  itemId: string
  name: string
  sku: string | null
  unitPriceMinor: number
  qty: number
  lineTotalMinor: number
}

export type Quote = {
  currency: string
  lines: QuotedLine[]
  subtotalMinor: number
}

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "unavailable"; itemIds: string[] }
  | { ok: false; reason: "mixed_currency"; currencies: string[] }
  | { ok: false; reason: "too_large" }

/** An order as other modules see it. Money in minor units of `currency`. */
export type Order = {
  id: string
  userId: string
  status: OrderStatus
  currency: string
  subtotalMinor: number
  /** Set by a discount (`applyOrderDiscount`), computed on the server. 0 = none. */
  discountMinor: number
  /** subtotal − discount. What `startCheckout` charges and what "paid" is compared with. */
  totalMinor: number
  discountCode: string | null
  discountRef: string | null
  /** `order:<id>`: the reference of its stock moves in `catalog`. */
  stockRef: string
  /** Last payment started for it (`payments.id`). The truth is `getPaymentByOrder(id)`. */
  paymentId: string | null
  expiresAt: Date
  paidAt: Date | null
  fulfilledAt: Date | null
  closedAt: Date | null
  stockReleasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Photo of a line taken when the order was created: later price changes do not touch it. */
export type OrderItem = {
  id: string
  orderId: string
  position: number
  itemId: string
  name: string
  sku: string | null
  unitPriceMinor: number
  qty: number
  lineTotalMinor: number
}

export type OrderHistoryEntry = {
  id: string
  orderId: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorKind: ActorKind
  actorId: string | null
  note: string | null
  createdAt: Date
}

export type OrderDetail = Order & { items: OrderItem[]; history: OrderHistoryEntry[] }

/** What the payment reconciliation needs from a `PaymentRecord` of payments/contracts. */
export type PaymentView = {
  id: string
  orderId: string
  status: "pending" | "failed" | "approved" | "refunded" | "canceled" | "needs_review"
  amountMinor: number
  currency: string
}

export const ORDER_ERROR_CODES = [
  /** The cart/request is malformed (ids, quantities, too many lines). */
  "invalid_input",
  "empty_cart",
  /** Some item is not sellable any more (`itemIds`). */
  "unavailable",
  "mixed_currency",
  "insufficient_stock",
  /** The server total differs from what the person confirmed: show the cart again. */
  "prices_changed",
  "not_found",
  /** The order is not in a status that allows this. */
  "invalid_status",
  /** It expired before paying. */
  "expired",
  /** A payment is open for it: cancel or settle it first (discounts). */
  "payment_started",
  /** payments says the order already has a different active payment. */
  "payment_conflict",
  /** Fulfil: the payment is not approved (or no longer: refunded, needs_review). */
  "payment_not_approved",
  /** A discount would leave nothing (or less than nothing) to charge. */
  "invalid_discount",
  /** Nothing to charge (free items only): payments cannot take a checkout of 0. */
  "zero_total",
  "too_large",
] as const
export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number]

export class OrderError extends Error {
  constructor(
    readonly code: OrderErrorCode,
    detail?: string,
    /** For `unavailable` / `insufficient_stock`: the items involved. */
    readonly itemIds: string[] = []
  ) {
    super(detail ?? `orders: ${code}`)
    this.name = "OrderError"
  }
}

/** Result of `expirePendingOrders()` (counts; never ids of people or amounts). */
export type ExpireReport = {
  checked: number
  expired: number
  /** Turned out to be paid (approved payment found before expiring). */
  paid: number
  review: number
  /** Not due any more, or not pending any more (someone else moved it). */
  skipped: number
  failed: number
}
