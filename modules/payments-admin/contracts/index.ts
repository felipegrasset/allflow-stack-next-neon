/**
 * The only thing another module (or the app) may import from payments-admin.
 * Pure: usable from server and client code.
 *
 *   import { startCheckout } from "@/modules/payments/contracts"
 *   import { paymentReturnPath } from "@/modules/payments-admin/contracts"
 *
 *   const { url } = await startCheckout({
 *     orderId: order.id,
 *     amountMinor: order.totalMinor,
 *     currency: "CLP",
 *     description: `Pedido ${order.id}`,
 *     returnPath: paymentReturnPath(order.id, `/orders/${order.id}`),
 *   })
 */

/** The admin screen. */
export const PAYMENTS_ADMIN_PATH = "/admin/payments"

/** The public page the person comes back to after paying. */
export const PAYMENT_RETURN_PATH = "/pago/retorno"

/**
 * `returnPath` for `startCheckout`: `/pago/retorno?order=<id>[&next=<path>]`.
 * The return page reconciles the order's payment with the provider
 * (`syncPayment`) and offers a link to `next` (an internal path; anything
 * else is ignored there).
 */
export function paymentReturnPath(orderId: string, next?: string): string {
  const q = new URLSearchParams({ order: orderId })
  if (next) q.set("next", next)
  return `${PAYMENT_RETURN_PATH}?${q.toString()}`
}

/** Link to the admin screen's lookup by order (it opens the order's payment). */
export function paymentAdminHref(orderId: string): string {
  return `${PAYMENTS_ADMIN_PATH}?${new URLSearchParams({ order: orderId }).toString()}`
}

/** Link to one payment's detail in the admin screen. */
export function paymentDetailHref(paymentId: string): string {
  return `${PAYMENTS_ADMIN_PATH}/${encodeURIComponent(paymentId)}`
}
