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
import * as queries from "../server/queries"
import * as subscriptions from "../server/subscriptions"

import type { ListPaymentsInput } from "./list"
import type {
  CancelSubscriptionTarget,
  CheckoutInput,
  SubscriptionInput,
} from "./types"

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
/**
 * La suscripción MÁS RECIENTE, en cualquier estado (fila cruda, snake_case).
 * Una `pending` nueva tapa a una `active` anterior: para «¿qué plan tiene
 * hoy?» usa `getActiveSubscription`. Se mantiene igual por compatibilidad.
 */
export const getSubscription = (subscriberRef: string) =>
  checkout.getSubscription(getKysely(), subscriberRef)
/** La que da derecho hoy (regla en `contracts/subscriptions.ts`), o `null`. */
export const getActiveSubscription = (subscriberRef: string) =>
  subscriptions.getActiveSubscription(getKysely(), subscriberRef)
/** Todas las de la persona, más nueva primero (máx. 100). */
export const listSubscriptions = (subscriberRef: string) =>
  subscriptions.listSubscriptions(getKysely(), subscriberRef)
/** Pide la cancelación al proveedor. El estado local cambia con su webhook. */
export const cancelSubscription = (
  target: CancelSubscriptionTarget,
  opts: { atPeriodEnd: boolean }
) => subscriptions.cancelSubscription(getKysely(), target, opts)
/** Pide el cambio de plan al proveedor. El `planRef` local cambia con su webhook. */
export const changeSubscriptionPlan = (
  subscriberRef: string,
  newPlanRef: string
) => subscriptions.changeSubscriptionPlan(getKysely(), subscriberRef, newPlanRef)

/** Solo lectura: lo que la base ya tiene, sin consultar al proveedor. */
export const listPayments = (input?: ListPaymentsInput) =>
  queries.listPayments(getKysely(), input)
export const getPayment = (paymentId: string) =>
  queries.getPayment(getKysely(), paymentId)

export { checkoutInputSchema, subscriptionInputSchema } from "./input"
export {
  InvalidCursorError,
  LIST_PAYMENTS_DEFAULT_LIMIT,
  LIST_PAYMENTS_MAX_LIMIT,
  listPaymentsInputSchema,
  type ListPaymentsInput,
  type PaymentsPage,
} from "./list"
export { currencyExponent, majorToMinor, minorToMajor } from "./money"
export {
  compareSubscriptions,
  pickActiveSubscription,
  subscriptionEntitles,
} from "./subscriptions"
export * from "./types"
