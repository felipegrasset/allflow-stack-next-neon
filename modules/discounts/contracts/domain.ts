/**
 * Pure rules of `discounts` (no `@/` imports, no database): code
 * normalisation, the discount amount and every condition of a code. The
 * server applies them under the code's row lock (server/redeem.ts); tested
 * without a database in tests/discounts.test.ts.
 *
 * ROUNDING (documented money rule): a percentage is computed on the order's
 * subtotal in minor units with integer arithmetic and rounded DOWN to the
 * minor unit (15 % of CLP 999 = 149.85 → 149; 10 % of USD 0.05 = 0.5 cent →
 * 0, which is `no_effect`). The buyer never gets more than the stated share.
 * Then every discount (percent or fixed) is capped at `subtotal − 1`: the
 * order must still charge at least one minor unit (orders and payments
 * require it), so a fixed discount larger than the subtotal leaves a total
 * of 1.
 */
import type {
  DiscountErrorCode,
  DiscountRejection,
  DiscountResult,
  DiscountRule,
  OrderForDiscount,
  ReleaseReason,
  UsageSnapshot,
} from "./types"

// ── codes ────────────────────────────────────────────────────────────────────

export const CODE_MIN = 3
export const CODE_MAX = 40
/** What a stored code looks like (after `normalizeCode`). */
export const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/

/**
 * What a person typed → the stored form: Unicode NFKC, every whitespace
 * removed (also inside: "verano 10" → "VERANO10"), upper case. Returns null
 * when the result is not a valid code (length 3..40, A-Z 0-9 _ -). Two codes
 * that differ only in case or spaces are the same code.
 */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null
  const s = raw.normalize("NFKC").replace(/\s+/g, "").toUpperCase()
  return CODE_PATTERN.test(s) ? s : null
}

export const isCode = (v: unknown): v is string => typeof v === "string" && CODE_PATTERN.test(v)

/** `discount:<id>` — what orders stores in `discount_ref`. */
export const discountRefOf = (codeId: string) => `discount:${codeId}`

// ── percentages ──────────────────────────────────────────────────────────────

export const MAX_PERCENT_BP = 10_000

/**
 * "10", "12.5", "12,75", "100" → basis points (1000, 1250, 1275, 10000).
 * At most two decimals; 0 or more than 100 → null. No floating point.
 */
export function parsePercent(text: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!m) return null
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"))
  return bp >= 1 && bp <= MAX_PERCENT_BP ? bp : null
}

/** Basis points → "12.5" (for forms and labels). */
export function formatPercent(bp: number): string {
  const whole = Math.floor(bp / 100)
  const frac = bp % 100
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`
}

// ── the amount ───────────────────────────────────────────────────────────────

/**
 * Raw discount of a rule on a subtotal, before the "total ≥ 1" cap: percent
 * rounded down (BigInt, so subtotals up to 2^53 never overflow), fixed as is.
 */
export function rawAmount(rule: Pick<DiscountRule, "kind" | "percentBp" | "amountMinor">, subtotalMinor: number): number {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0) return 0
  if (rule.kind === "percent") {
    const bp = rule.percentBp ?? 0
    if (!Number.isSafeInteger(bp) || bp <= 0) return 0
    return Number((BigInt(subtotalMinor) * BigInt(Math.min(bp, MAX_PERCENT_BP))) / BigInt(MAX_PERCENT_BP))
  }
  const a = rule.amountMinor ?? 0
  return Number.isSafeInteger(a) && a > 0 ? a : 0
}

/** The discount actually applied: raw amount capped so the total stays ≥ 1. 0 = no effect. */
export function cappedAmount(rule: Pick<DiscountRule, "kind" | "percentBp" | "amountMinor">, subtotalMinor: number): number {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 1) return 0
  return Math.min(rawAmount(rule, subtotalMinor), subtotalMinor - 1)
}

const sameCurrency = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

/**
 * THE RULE. Does `rule` apply to an order with this subtotal and currency,
 * given its active uses (read under the code's row lock), and for how much?
 * Checks, in order: active, starts_at ≤ now, now < ends_at, currency, minimum
 * subtotal, total uses, uses per person, then the amount (> 0 after rounding
 * and the cap). Never returns a total below 1.
 */
export function applyDiscount(
  rule: DiscountRule,
  order: OrderForDiscount,
  ctx: { now: Date; usage: UsageSnapshot }
): DiscountResult {
  if (!rule.active) return { ok: false, reason: "inactive" }
  const t = ctx.now.getTime()
  if (rule.startsAt && t < rule.startsAt.getTime()) return { ok: false, reason: "not_started" }
  if (rule.endsAt && t >= rule.endsAt.getTime()) return { ok: false, reason: "ended" }
  if (rule.currency && !sameCurrency(rule.currency, order.currency)) return { ok: false, reason: "currency_mismatch" }
  // A fixed amount without a currency cannot be compared: refuse rather than guess.
  if (rule.kind === "fixed" && !rule.currency) return { ok: false, reason: "currency_mismatch" }
  if (rule.minSubtotalMinor !== null && order.subtotalMinor < rule.minSubtotalMinor)
    return { ok: false, reason: "below_minimum" }
  if (rule.maxUses !== null && ctx.usage.usesTotal >= rule.maxUses) return { ok: false, reason: "exhausted" }
  if (rule.maxUsesPerUser !== null && ctx.usage.usesByUser >= rule.maxUsesPerUser)
    return { ok: false, reason: "user_limit" }
  const amountMinor = cappedAmount(rule, order.subtotalMinor)
  if (amountMinor < 1) return { ok: false, reason: "no_effect" }
  return { ok: true, amountMinor, totalMinor: order.subtotalMinor - amountMinor }
}

/**
 * Rejection → what the buyer is told. "inactive" and "not started" answer the
 * same as "does not exist" (`invalid_code`): a guess learns nothing.
 */
export function rejectionError(reason: DiscountRejection): DiscountErrorCode {
  switch (reason) {
    case "inactive":
    case "not_started":
      return "invalid_code"
    default:
      return reason
  }
}

/**
 * orders' `OrderError.code` (thrown by `applyOrderDiscount`) → what the buyer
 * is told. Anything unexpected → `unknown`.
 */
export function orderErrorToDiscount(code: string): DiscountErrorCode {
  switch (code) {
    case "not_found":
      return "order_not_found"
    case "invalid_status":
      return "order_not_pending"
    case "expired":
      return "order_expired"
    case "payment_started":
      return "payment_started"
    case "invalid_discount":
      return "order_rejected"
    default:
      return "unknown"
  }
}

/** The database's cap trigger (0127) → error code, recognised by its message. Null if it is not one. */
export function capErrorFromMessage(message: string): DiscountErrorCode | null {
  if (message.includes("discounts: usage limit reached")) return "exhausted"
  if (message.includes("discounts: per-user limit reached")) return "user_limit"
  return null
}

/** A use counts toward the caps while it is not released. */
export const isCapReached = (rule: Pick<DiscountRule, "maxUses" | "maxUsesPerUser">, usage: UsageSnapshot) =>
  (rule.maxUses !== null && usage.usesTotal >= rule.maxUses) ||
  (rule.maxUsesPerUser !== null && usage.usesByUser >= rule.maxUsesPerUser)

// ── releasing a use ──────────────────────────────────────────────────────────

/** orders' statuses, as plain strings (no runtime import of orders here). */
export type OrderStatusLike = "pending" | "review" | "paid" | "fulfilled" | "canceled" | "expired"

export type ReleaseDecision = { action: "release"; reason: ReleaseReason } | { action: "confirm" } | { action: "keep" }

/**
 * What to do with an order's active use given the order now: canceled /
 * expired / gone → release it (the code can be used again); paid / fulfilled
 * → confirm it (final); pending / review → keep (it may still be paid).
 */
export function releaseDecision(status: OrderStatusLike | null): ReleaseDecision {
  if (status === null) return { action: "release", reason: "order_missing" }
  if (status === "canceled") return { action: "release", reason: "order_canceled" }
  if (status === "expired") return { action: "release", reason: "order_expired" }
  if (status === "paid" || status === "fulfilled") return { action: "confirm" }
  return { action: "keep" }
}

// ── admin validation ─────────────────────────────────────────────────────────

export type RuleShape = Pick<
  DiscountRule,
  "kind" | "percentBp" | "amountMinor" | "currency" | "minSubtotalMinor" | "startsAt" | "endsAt" | "maxUses" | "maxUsesPerUser"
>

export type RuleProblem =
  | "percent_required"
  | "amount_required"
  | "currency_required"
  | "dates_order"
  | "per_user_above_total"

/**
 * Coherence of a code the admin is saving (the database checks the same).
 * - percent ⇔ percentBp; fixed ⇔ amountMinor and currency;
 * - a minimum purchase needs a currency (amounts are compared in one currency);
 * - starts < ends; per-person cap ≤ total cap.
 */
export function ruleProblems(r: RuleShape): RuleProblem[] {
  const out: RuleProblem[] = []
  if (r.kind === "percent" && (r.percentBp === null || r.percentBp < 1 || r.percentBp > MAX_PERCENT_BP))
    out.push("percent_required")
  if (r.kind === "fixed" && (r.amountMinor === null || r.amountMinor < 1)) out.push("amount_required")
  if ((r.kind === "fixed" || r.minSubtotalMinor !== null) && !r.currency) out.push("currency_required")
  if (r.startsAt && r.endsAt && r.startsAt.getTime() >= r.endsAt.getTime()) out.push("dates_order")
  if (r.maxUses !== null && r.maxUsesPerUser !== null && r.maxUsesPerUser > r.maxUses) out.push("per_user_above_total")
  return out
}

/** Status shown in the admin list. */
export type CodeState = "active" | "inactive" | "scheduled" | "ended" | "exhausted"

export function codeState(rule: DiscountRule, activeUses: number, now: Date): CodeState {
  if (!rule.active) return "inactive"
  if (rule.endsAt && now.getTime() >= rule.endsAt.getTime()) return "ended"
  if (rule.startsAt && now.getTime() < rule.startsAt.getTime()) return "scheduled"
  if (rule.maxUses !== null && activeUses >= rule.maxUses) return "exhausted"
  return "active"
}
