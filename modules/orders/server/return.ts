import { clientIp, consume } from "@/server/rate-limit"

/** Per IP and order, and per IP in total: every unsettled return visit may cost a provider call. */
export const RETURN_LIMITS = {
  perOrder: { max: 10, windowMs: 60_000 },
  perIp: { max: 30, windowMs: 60_000 },
} as const

/**
 * May this visit to an order page ask the payment provider? Only when the
 * person comes back from the checkout (`?pago=1`) and within the limits. Over
 * the limit, or the limiter failing, means no: the page shows what the
 * database knows and the webhook (or the next visit) settles it.
 */
export async function mayAskProvider(orderId: string): Promise<boolean> {
  try {
    const ip = await clientIp()
    if (!(await consume(`orders-return:${ip}:${orderId}`, RETURN_LIMITS.perOrder)).ok) return false
    return (await consume(`orders-return:${ip}`, RETURN_LIMITS.perIp)).ok
  } catch {
    return false
  }
}
