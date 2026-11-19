/**
 * Pure rules of `orders` (no `@/` imports, no database): cart normalisation,
 * the server-side quote, discounts, status transitions and the payment /
 * expiry decisions that server/lifecycle.ts applies under a row lock.
 * Tested without a database in tests/orders.test.ts.
 */
import {
  MAX_CART_LINES,
  MAX_LINE_QTY,
  type CartLine,
  type OrderStatus,
  type PaymentView,
  type QuoteResult,
  type QuotedLine,
} from "./types"

// ── ids and quantities ───────────────────────────────────────────────────────

/** Catalog item ids as catalog accepts them (non-empty, ≤ 100, no control chars). */
export const isItemId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 100 && !/[\u0000-\u001f\u007f]/.test(v)

export const isLineQty = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= MAX_LINE_QTY

/** Order ids are random UUIDs (never sequential: an id in a URL reveals nothing). */
export const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isOrderId = (v: unknown): v is string => typeof v === "string" && ORDER_ID.test(v)

/** `order:<id>` — the reference of an order's stock moves in catalog. */
export const stockRefOf = (orderId: string) => `order:${orderId}`

/** Short, human reference shown to people ("A1B2C3D4"). Not unique by itself; the id is. */
export const shortOrderRef = (orderId: string) => orderId.replace(/-/g, "").slice(0, 8).toUpperCase()

// ── cart ─────────────────────────────────────────────────────────────────────

/**
 * Cleans what came from the cookie or a form: drops malformed lines, joins
 * repeated items (quantities added, capped at MAX_LINE_QTY), keeps the first
 * MAX_CART_LINES distinct items in order of appearance.
 */
export function normalizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return []
  const sums = new Map<string, number>()
  for (const l of raw) {
    if (typeof l !== "object" || l === null) continue
    const { itemId, qty } = l as { itemId?: unknown; qty?: unknown }
    if (!isItemId(itemId) || !isLineQty(qty)) continue
    if (!sums.has(itemId) && sums.size >= MAX_CART_LINES) continue
    sums.set(itemId, Math.min(MAX_LINE_QTY, (sums.get(itemId) ?? 0) + qty))
  }
  return [...sums.entries()].map(([itemId, qty]) => ({ itemId, qty }))
}

export type CartChange =
  | { ok: true; cart: CartLine[] }
  | { ok: false; reason: "invalid" | "full" }

/** Adds `qty` of an item (capped). Fails when the cart already has MAX_CART_LINES other items. */
export function addToCart(cart: readonly CartLine[], itemId: string, qty: number): CartChange {
  if (!isItemId(itemId) || !isLineQty(qty)) return { ok: false, reason: "invalid" }
  const has = cart.some((l) => l.itemId === itemId)
  if (!has && cart.length >= MAX_CART_LINES) return { ok: false, reason: "full" }
  if (!has) return { ok: true, cart: [...cart, { itemId, qty }] }
  return {
    ok: true,
    cart: cart.map((l) => (l.itemId === itemId ? { itemId, qty: Math.min(MAX_LINE_QTY, l.qty + qty) } : l)),
  }
}

/** Sets the quantity of an item; 0 removes it. Unknown item → unchanged. */
export function setCartQty(cart: readonly CartLine[], itemId: string, qty: number): CartChange {
  if (!isItemId(itemId) || !Number.isSafeInteger(qty) || qty < 0 || qty > MAX_LINE_QTY)
    return { ok: false, reason: "invalid" }
  if (qty === 0) return { ok: true, cart: cart.filter((l) => l.itemId !== itemId) }
  return { ok: true, cart: cart.map((l) => (l.itemId === itemId ? { itemId, qty } : l)) }
}

// ── quote (prices ALWAYS from catalog) ───────────────────────────────────────

/** What the quote reads from a catalog `SellableItem`. */
export type PriceSource = {
  id: string
  name: string
  sku: string | null
  priceMinor: number
  currency: string
}

/**
 * Prices a cart with what catalog returned (`getSellableItems`). The browser
 * sends ids and quantities only; every price and the total are computed here.
 * - every line must have its item among `items` (catalog omits what is not
 *   sellable: compare, don't assume) → else `unavailable` with the ids;
 * - one currency per order → else `mixed_currency`;
 * - integers only; a total beyond 2^53 → `too_large`.
 */
export function quoteCart(cart: readonly CartLine[], items: readonly PriceSource[]): QuoteResult {
  const lines = normalizeCart(cart)
  if (lines.length === 0) return { ok: false, reason: "empty" }
  const byId = new Map(items.map((i) => [i.id, i]))
  const missing = lines.filter((l) => !byId.has(l.itemId)).map((l) => l.itemId)
  if (missing.length) return { ok: false, reason: "unavailable", itemIds: missing }
  const currencies = [...new Set(lines.map((l) => byId.get(l.itemId)!.currency.trim().toUpperCase()))]
  if (currencies.length !== 1) return { ok: false, reason: "mixed_currency", currencies: currencies.sort() }
  let subtotal = 0
  const quoted: QuotedLine[] = []
  for (const l of lines) {
    const item = byId.get(l.itemId)!
    const unit = item.priceMinor
    if (!Number.isSafeInteger(unit) || unit < 0) return { ok: false, reason: "too_large" }
    const lineTotal = unit * l.qty
    if (!Number.isSafeInteger(lineTotal)) return { ok: false, reason: "too_large" }
    subtotal += lineTotal
    if (!Number.isSafeInteger(subtotal)) return { ok: false, reason: "too_large" }
    quoted.push({ itemId: item.id, name: item.name, sku: item.sku, unitPriceMinor: unit, qty: l.qty, lineTotalMinor: lineTotal })
  }
  return { ok: true, quote: { currency: currencies[0]!, lines: quoted, subtotalMinor: subtotal } }
}

// ── discounts (the hook for the `discounts` module) ──────────────────────────

/**
 * total = subtotal − discount. The discount is an integer in minor units,
 * 0 ≤ discount < subtotal: the order must still charge at least one minor
 * unit (payments rejects a checkout of 0). Returns null when invalid.
 */
export function totalAfterDiscount(subtotalMinor: number, discountMinor: number): number | null {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) return null
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0) return null
  const total = subtotalMinor - discountMinor
  return total >= 1 ? total : null
}

// ── status transitions ───────────────────────────────────────────────────────

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "review", "canceled", "expired"],
  review: ["paid", "canceled"],
  paid: ["fulfilled"],
  fulfilled: [],
  canceled: [],
  expired: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from].includes(to)

/** Moving to `to` gives the stock back (exactly once: only these targets, only from pending/review). */
export const releasesStock = (to: OrderStatus): boolean => to === "canceled" || to === "expired"

/** Who may cancel: the buyer only while pending; staff also from review. Never once paid. */
export function canCancel(status: OrderStatus, asStaff: boolean): boolean {
  if (status === "pending") return true
  return asStaff && status === "review"
}

// ── payment → order ──────────────────────────────────────────────────────────

export type PaymentDecision = "mark_paid" | "mark_review" | "none"

/**
 * What the payment says about an order. The ONLY way to "paid":
 * `payment.status === "approved"` for THIS order with amount AND currency
 * equal to the stored total. `needs_review`, a refund, or an approved amount
 * that does not match → review (a person looks; never fulfilled).
 * pending / failed / canceled / no payment → nothing yet.
 */
export function decidePayment(
  order: { id: string; totalMinor: number; currency: string },
  payment: PaymentView | null
): PaymentDecision {
  if (!payment || payment.orderId !== order.id) return "none"
  switch (payment.status) {
    case "approved":
      return payment.amountMinor === order.totalMinor &&
        payment.currency.trim().toUpperCase() === order.currency.trim().toUpperCase()
        ? "mark_paid"
        : "mark_review"
    case "needs_review":
    case "refunded":
      return "mark_review"
    default:
      return "none"
  }
}

/** Applies a decision to an order's current status: the target, or null when nothing changes. */
export function paymentTarget(status: OrderStatus, decision: PaymentDecision): "paid" | "review" | null {
  if (decision === "mark_paid" && (status === "pending" || status === "review")) return "paid"
  if (decision === "mark_review" && status === "pending") return "review"
  return null
}

export type ExpiryPlan =
  | { action: "not_due" }
  | { action: "skip" }
  | { action: "to"; status: "paid" | "review" }
  /** An open payment must be cancelled in payments before giving the stock back. */
  | { action: "cancel_payment_then_release"; paymentId: string }
  | { action: "release" }

/**
 * Whether a pending order can expire now. Before giving stock back it looks
 * at the payment: approved → paid instead; needs_review/refunded → review;
 * an open payment (pending/failed) → cancel it first (if payments refuses,
 * re-read and decide again); no payment or a cancelled one → expire.
 */
export function planExpiry(
  order: { id: string; status: OrderStatus; totalMinor: number; currency: string; expiresAt: Date },
  payment: PaymentView | null,
  now: Date
): ExpiryPlan {
  if (order.status !== "pending") return { action: "skip" }
  const target = paymentTarget(order.status, decidePayment(order, payment))
  if (target === "paid" || target === "review") return { action: "to", status: target }
  if (order.expiresAt.getTime() > now.getTime()) return { action: "not_due" }
  if (payment && payment.orderId === order.id && (payment.status === "pending" || payment.status === "failed"))
    return { action: "cancel_payment_then_release", paymentId: payment.id }
  return { action: "release" }
}

/** Cancel (buyer or staff) — same payment checks as expiry, without the clock. */
export function planCancel(
  order: { id: string; status: OrderStatus; totalMinor: number; currency: string },
  payment: PaymentView | null,
  asStaff: boolean
): ExpiryPlan {
  if (!canCancel(order.status, asStaff)) return { action: "skip" }
  if (order.status === "pending") {
    const target = paymentTarget(order.status, decidePayment(order, payment))
    if (target === "paid") return { action: "to", status: "paid" }
    // A buyer cannot cancel what is under review; staff can (that is what review is for).
    if (target === "review") return asStaff ? { action: "release" } : { action: "to", status: "review" }
  } else if (decidePayment(order, payment) === "mark_paid") {
    // review, but the payment has since been approved with the right amount.
    return { action: "to", status: "paid" }
  }
  if (payment && payment.orderId === order.id && (payment.status === "pending" || payment.status === "failed"))
    return { action: "cancel_payment_then_release", paymentId: payment.id }
  return { action: "release" }
}

// ── configuration ────────────────────────────────────────────────────────────

export const DEFAULT_PENDING_TTL_MINUTES = 30
export const MIN_PENDING_TTL_MINUTES = 5
export const MAX_PENDING_TTL_MINUTES = 7 * 24 * 60

/** `ORDERS_PENDING_TTL_MINUTES` → minutes, clamped to [5, 10080]; missing or garbage → 30. */
export function pendingTtlMinutes(raw: string | undefined): number {
  if (!raw || !/^\d{1,6}$/.test(raw.trim())) return DEFAULT_PENDING_TTL_MINUTES
  const n = Number(raw.trim())
  return Math.min(MAX_PENDING_TTL_MINUTES, Math.max(MIN_PENDING_TTL_MINUTES, n))
}

export const expiresAtFrom = (now: Date, ttlMinutes: number) => new Date(now.getTime() + ttlMinutes * 60_000)
