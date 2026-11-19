/**
 * Types, constants and errors of `discounts`. Pure: no server or client APIs,
 * so a server action, a client component, a test and another module can all
 * import it.
 */

/** `percent`: a share of the subtotal (basis points). `fixed`: an amount in one currency. */
export const DISCOUNT_KINDS = ["percent", "fixed"] as const
export type DiscountKind = (typeof DISCOUNT_KINDS)[number]

/** A code as the pure rules see it. Money in minor units. */
export type DiscountRule = {
  id: string
  /** Normalised (`normalizeCode`): upper case, no spaces. */
  code: string
  kind: DiscountKind
  /** percent only: 1..10000 (1000 = 10 %). */
  percentBp: number | null
  /** fixed only: ≥ 1, in `currency`'s minor unit. */
  amountMinor: number | null
  /** Required for `fixed` and for `minSubtotalMinor`; optional for `percent` (null = any currency). */
  currency: string | null
  /** Minimum order subtotal (before discount), in `currency`. null = none. */
  minSubtotalMinor: number | null
  /** Valid from this instant (inclusive). null = always. */
  startsAt: Date | null
  /** Valid until this instant (exclusive). null = never ends. */
  endsAt: Date | null
  /** Total active uses allowed. null = unlimited. */
  maxUses: number | null
  /** Active uses allowed per person (the order's buyer). null = unlimited. */
  maxUsesPerUser: number | null
  active: boolean
}

/** A code with its admin fields. */
export type DiscountCode = DiscountRule & {
  /** Internal note, only seen in /admin/discounts. */
  note: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

/** A code plus how many active uses it has (admin list). */
export type DiscountCodeWithUses = DiscountCode & { activeUses: number }

/** Why a release happened (`discounts_redemptions.release_reason`). */
export const RELEASE_REASONS = ["removed", "replaced", "order_canceled", "order_expired", "order_missing"] as const
export type ReleaseReason = (typeof RELEASE_REASONS)[number]

/**
 * One use of a code on one order. Active while `releasedAt` is null; at most
 * one active per order (the database enforces it). The amount is what was
 * written on the order, computed on the server at that moment.
 */
export type Redemption = {
  id: string
  codeId: string
  code: string
  orderId: string
  userId: string
  amountMinor: number
  currency: string
  subtotalMinor: number
  createdAt: Date
  releasedAt: Date | null
  releaseReason: ReleaseReason | null
  /** Set once the order is known to be paid/fulfilled (the use is final). */
  confirmedAt: Date | null
}

/** What the pure rule needs from a stored order (orders' `Order`). */
export type OrderForDiscount = { subtotalMinor: number; currency: string }

/** Active uses at the moment of deciding (read under the code's row lock). */
export type UsageSnapshot = { usesTotal: number; usesByUser: number }

/** Why a code does not apply to an order. Pure-rule reasons. */
export const DISCOUNT_REJECTIONS = [
  "inactive",
  "not_started",
  "ended",
  "currency_mismatch",
  "below_minimum",
  "exhausted",
  "user_limit",
  /** It would discount nothing (0 after rounding, or a subtotal of 1). */
  "no_effect",
] as const
export type DiscountRejection = (typeof DISCOUNT_REJECTIONS)[number]

export type DiscountResult =
  | { ok: true; amountMinor: number; totalMinor: number }
  | { ok: false; reason: DiscountRejection }

/**
 * Error codes of the module. Each maps 1:1 to `discounts.errors.<code>` in
 * messages.ts, so the UI shows a translated text, never `message`.
 * `invalid_code` covers "does not exist", "inactive" and "not started yet",
 * so a guess learns nothing about which codes exist.
 */
export const DISCOUNT_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_input",
  "rate_limited",
  "invalid_code",
  "ended",
  "currency_mismatch",
  "below_minimum",
  "exhausted",
  "user_limit",
  "no_effect",
  /** The order does not exist or is not the person's (same answer: ids reveal nothing). */
  "order_not_found",
  "order_not_pending",
  "order_expired",
  /** Checkout already started: cancel that payment first (orders' rule). */
  "payment_started",
  /** orders refused the amount (total would drop below one minor unit). */
  "order_rejected",
  "nothing_to_remove",
  "code_taken",
  "not_found",
  "unknown",
] as const
export type DiscountErrorCode = (typeof DISCOUNT_ERROR_CODES)[number]

export class DiscountError extends Error {
  constructor(readonly code: DiscountErrorCode) {
    super(`discounts: ${code}`)
    this.name = "DiscountError"
  }
}

/** Result of `releaseDiscountForOrder` (idempotent). */
export type ReleaseOutcome =
  | { kind: "none" }
  | { kind: "released"; reason: ReleaseReason }
  | { kind: "confirmed" }
  | { kind: "kept" }

/** Result of `releaseStaleDiscounts` (counts only). */
export type SweepReport = { checked: number; released: number; confirmed: number; kept: number; failed: number }
