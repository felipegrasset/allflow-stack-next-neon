import {
  getPayment,
  getPaymentByOrder,
  syncPayment,
  type PaymentRecord,
  type PaymentStatus,
} from "@/modules/payments/contracts"

import { clientIp, consume } from "@/server/rate-limit"

import { errorName, logAdmin } from "./log"
import { returnRateLimits, type ReturnLookup } from "./logic"

/** Already final for the person who pays: no need to ask the provider again. */
const SETTLED: readonly PaymentStatus[] = ["approved", "refunded"]

/**
 * May this visit ask the provider? The page is public and every unsettled
 * visit costs a provider call, so it counts against the per-IP limits first
 * (`returnRateLimits`). Over the limit, or the limiter failing, means "no":
 * the page then shows what the database already knows and never calls out.
 */
async function mayAskProvider(lookup: ReturnLookup): Promise<boolean> {
  const buckets = returnRateLimits(lookup, await clientIp())
  if (!buckets) return false
  try {
    for (const { key, rule } of buckets) if (!(await consume(key, rule)).ok) return false
    return true
  } catch {
    return false
  }
}

/**
 * What the return page does: find the payment and reconcile it with the
 * provider (`syncPayment`), so the person sees the real state without
 * waiting for the webhook. It never decides a state itself: whatever
 * `syncPayment` applies is what the PROVIDER answered, with the server's key,
 * for THIS payment.
 *
 * The provider reference from the URL is untrusted: if `syncPayment` rejects
 * it, we retry once with the reference stored in the payment.
 *
 * Before asking the provider the visit is rate limited (`mayAskProvider`).
 * Over the limit, the stored status is shown and the provider is not asked.
 *
 * Returns the status, or `null` when there is no payment to show.
 */
export async function reconcileReturn(lookup: ReturnLookup): Promise<{ found: boolean; status: PaymentStatus | null }> {
  if (lookup.kind === "none") return { found: false, status: null }

  let record: PaymentRecord | null = null
  let paymentId: string
  if (lookup.kind === "order") {
    record = await getPaymentByOrder(lookup.orderId)
    if (!record) return { found: false, status: null }
    if (SETTLED.includes(record.status)) return { found: true, status: record.status }
    paymentId = record.id
  } else {
    paymentId = lookup.paymentId
  }

  if (!(await mayAskProvider(lookup))) {
    logAdmin({ action: "return", outcome: "rate_limited", paymentId })
    const stored = record ?? (await getPayment(paymentId))
    return stored ? { found: true, status: stored.status } : { found: false, status: null }
  }

  const attempts: (string | undefined)[] = lookup.providerRef ? [lookup.providerRef, undefined] : [undefined]
  for (const ref of attempts) {
    try {
      const fresh = await syncPayment(paymentId, ref)
      logAdmin({ action: "return", outcome: fresh.status, paymentId })
      return { found: true, status: fresh.status }
    } catch (e) {
      logAdmin({ action: "return", outcome: "sync_error", paymentId, error: errorName(e) })
    }
  }
  // Could not reach the provider (or the reference is not this payment's):
  // show what we already know; the webhook will settle it.
  return record ? { found: true, status: record.status } : { found: false, status: null }
}
