/**
 * Refund guard, pure part. A refund request reserves money BEFORE the provider
 * is called, in the same transaction that locks the payment row; the
 * reservation is released only when the provider confirms (the payment's
 * `refunded_minor` reaches the request's `expected_total_minor`) or when the
 * call clearly failed. So two requests for the same pending amount can never
 * both reach the provider.
 *
 * Each request stores `expected_total_minor`: the payment's refunded total
 * once it AND every earlier open request are confirmed. A request is open
 * while its status is requested/sent/unknown and that total is still above
 * the confirmed `refunded_minor`. Then:
 *
 *   base      = max(refunded_minor, max expected_total_minor of open requests)
 *   available = amount_minor - base
 */
import { ProviderApiError, RefundInProgressError } from "../contracts/types"

export const OPEN_REFUND_STATUSES = ["requested", "sent", "unknown"] as const
export type RefundRequestStatus =
  | (typeof OPEN_REFUND_STATUSES)[number]
  | "failed"

export type RefundPlanInput = {
  paymentId: string
  amountMinor: number
  refundedMinor: number
  /** `expected_total_minor` of requests with an open status. */
  openExpectedTotals: readonly number[]
  /** Undefined = refund everything left. */
  requestedMinor?: number
}

export type RefundPlan = { reserveMinor: number; expectedTotalMinor: number }

/** Throws `RefundInProgressError` when the request collides with an open one. */
export function planRefund(input: RefundPlanInput): RefundPlan {
  const { amountMinor, refundedMinor, requestedMinor } = input
  const remaining = amountMinor - refundedMinor
  const pending = input.openExpectedTotals.filter((t) => t > refundedMinor)
  const base = Math.max(refundedMinor, ...pending)
  const available = Math.max(0, amountMinor - base)

  if (requestedMinor === undefined) {
    if (remaining <= 0) throw new Error("Monto de reembolso inválido")
    // "Everything left" while another refund is unconfirmed would refund
    // that other one's money a second time.
    if (pending.length > 0)
      throw new RefundInProgressError(input.paymentId, available)
    return { reserveMinor: remaining, expectedTotalMinor: amountMinor }
  }
  if (
    !Number.isSafeInteger(requestedMinor) ||
    requestedMinor <= 0 ||
    requestedMinor > remaining
  ) {
    throw new Error("Monto de reembolso inválido")
  }
  if (requestedMinor > available)
    throw new RefundInProgressError(input.paymentId, available)
  return {
    reserveMinor: requestedMinor,
    expectedTotalMinor: base + requestedMinor,
  }
}

/**
 * After the provider call threw: was nothing refunded for sure (`failed`,
 * releases the reservation) or is it uncertain (`unknown`, stays reserved)?
 * A 4xx or an error that is not a `ProviderApiError` (validation before any
 * request) means nothing happened; a timeout, network error, 5xx or a 2xx
 * with an unreadable body may have refunded.
 */
export function refundFailureStatus(e: unknown): "failed" | "unknown" {
  if (!(e instanceof ProviderApiError)) return "failed"
  return e.status >= 400 && e.status < 500 ? "failed" : "unknown"
}
