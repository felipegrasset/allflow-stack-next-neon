/**
 * Lo único que otro módulo (o la app) puede importar de `payments`. Todo es de
 * servidor: no lo llames desde un componente de cliente.
 *
 *   import { startCheckout } from "@/modules/payments/contracts"
 *   const { url } = await startCheckout({ orderId, amountMinor, currency: "CLP",
 *     description: "Pedido 42", returnPath: "/orders/42" })
 *   redirect(url)
 *
 * El monto sale de TU orden en el servidor. El módulo lo guarda y es contra
 * esa cifra que compara lo que informa el proveedor.
 */
import { getKysely } from "@/server/db/pool"

import * as checkout from "../server/checkout"

import type { CheckoutInput, SubscriptionInput } from "./types"

export const startCheckout = (input: CheckoutInput) =>
  checkout.startCheckout(getKysely(), input)
export const getPaymentByOrder = (orderId: string) =>
  checkout.getPaymentByOrder(getKysely(), orderId)
export const cancelPayment = (paymentId: string) =>
  checkout.cancelPayment(getKysely(), paymentId)
export const syncPayment = (paymentId: string, providerRef?: string) =>
  checkout.syncPayment(getKysely(), paymentId, providerRef)
export const refundPayment = (paymentId: string, amountMinor?: number) =>
  checkout.refundPayment(getKysely(), paymentId, amountMinor)
export const startSubscription = (input: SubscriptionInput) =>
  checkout.startSubscription(getKysely(), input)
export const getSubscription = (subscriberRef: string) =>
  checkout.getSubscription(getKysely(), subscriberRef)

export { checkoutInputSchema, subscriptionInputSchema } from "./input"
export { currencyExponent, majorToMinor, minorToMajor } from "./money"
export * from "./types"
