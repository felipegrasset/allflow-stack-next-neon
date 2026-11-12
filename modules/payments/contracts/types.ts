/**
 * Tipos y errores del módulo `payments`. Sin base de datos ni red: los importan
 * los proveedores, la app y las pruebas.
 */

export const PROVIDER_IDS = ["mercadopago", "flow", "paddle"] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

/** `sandbox` por defecto: sin `PAYMENTS_ENV=production` no se toca plata real. */
export type PaymentsEnvironment = "sandbox" | "production"

export const PAYMENT_STATUSES = [
  "pending",
  "failed",
  "approved",
  "refunded",
  "canceled",
  "needs_review",
] as const
/**
 * - `pending`: checkout creado, sin pago aprobado.
 * - `failed`: el proveedor rechazó un intento; **no es terminal** (Mercado Pago deja reintentar en la misma preferencia).
 * - `approved`: pagado, el monto coincide con el de la orden.
 * - `refunded`: devuelto por completo.
 * - `canceled`: la app lo abandonó (`cancelPayment`); libera la orden. Un pago aprobado que llegue después va a `needs_review`.
 * - `needs_review`: llegó plata que no cuadra (monto distinto, pago sobre un checkout cancelado, reembolso sin pago). Lo resuelve una persona.
 */
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Estados que ocupan la orden: solo uno por `order_id` (índice único parcial). */
export const ACTIVE_STATUSES = [
  "pending",
  "failed",
  "approved",
  "needs_review",
] as const satisfies readonly PaymentStatus[]

/** Lo que la app pide. `amountMinor` sale SIEMPRE de la orden en el servidor, nunca del navegador. */
export type CheckoutInput = {
  /** Id de la orden de la app. Una orden activa tiene a lo más un pago. */
  orderId: string
  /** Entero en la unidad menor de la moneda (CLP: pesos; USD: centavos). */
  amountMinor: number
  /** ISO 4217, tres letras. */
  currency: string
  description: string
  payerEmail?: string
  /** Ruta interna a la que vuelve la persona, p. ej. `/orders/42`. */
  returnPath: string
  /** Si falta, `PAYMENTS_PROVIDER`, y si no, el primero configurado. */
  provider?: ProviderId
}

/** Lo que recibe el proveedor: ya validado, con el id del pago de la app y URLs absolutas. */
export type ProviderCheckoutInput = {
  paymentId: string
  orderId: string
  amountMinor: number
  currency: string
  description: string
  payerEmail?: string
  successUrl: string
  failureUrl: string
  pendingUrl: string
  notificationUrl: string
  environment: PaymentsEnvironment
}

export type ProviderCheckout = {
  /** Referencia del proveedor (preferencia, token, transacción). */
  id: string
  /** Dónde se manda a la persona a pagar. */
  url: string
}

/** Lo que el proveedor dice que pasó con un pago (consulta autenticada con la llave de API). */
export type ProviderPaymentState = {
  status: "approved" | "pending" | "failed" | "refunded"
  /** Id del pago del proveedor (el que se usa para reembolsar). */
  providerPaymentId: string
  /** Id del pago de la app, si el proveedor lo devuelve (`external_reference`, `commerceOrder`, `custom_data`). */
  paymentId?: string
  amountMinor?: number
  currency?: string
  /** Total reembolsado hasta ahora. */
  refundedMinor?: number
}

export type SubscriptionInput = {
  /** Id de la persona o cuenta en la app. */
  subscriberRef: string
  /** Id del plan en el proveedor. */
  planRef: string
  payerEmail?: string
  returnPath: string
  provider?: ProviderId
}

/** Eventos normalizados (plan §5.1). Los entrega `parseWebhook` YA autenticados. */
export type PaymentEventBase = {
  provider: ProviderId
  /**
   * Identificador del evento, estable entre reintentos del proveedor. Es la
   * clave de idempotencia: `(provider, eventId)` es único.
   */
  eventId: string
}

export type PaymentEvent =
  | (PaymentEventBase & {
      kind: "payment"
      type: "payment.approved"
      /** Id del pago de la app (`external_reference`). Si falta, se busca por `providerPaymentId`. */
      paymentId?: string
      providerPaymentId: string
      /** Obligatorios: sin monto no hay forma de compararlo con la orden. */
      amountMinor: number
      currency: string
    })
  | (PaymentEventBase & {
      kind: "payment"
      type: "payment.pending" | "payment.failed"
      paymentId?: string
      providerPaymentId: string
      amountMinor?: number
      currency?: string
    })
  | (PaymentEventBase & {
      kind: "payment"
      type: "payment.refunded"
      paymentId?: string
      providerPaymentId: string
      /** Total reembolsado hasta ahora (no el último reembolso). */
      refundedMinor: number
      currency?: string
    })
  | (PaymentEventBase & {
      kind: "subscription"
      type:
        | "subscription.active"
        | "subscription.past_due"
        | "subscription.canceled"
      /** Id de la suscripción en el proveedor. */
      externalId: string
      /** Id de la persona en la app; el primer evento de una suscripción nueva debe traerlo. */
      subscriberRef?: string
      planRef?: string
      currentPeriodEnd?: Date
    })

export type PaymentEventType = PaymentEvent["type"]

/**
 * El contrato que implementa cada pasarela (plan §5.1). Un proveedor no habla
 * con la base de datos: autentica, consulta y traduce. El núcleo escribe.
 */
export interface PaymentProvider {
  readonly id: ProviderId
  /** Crea el checkout alojado. La app nunca ve una tarjeta. */
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckout>
  /**
   * Autentica la notificación y la traduce a eventos. `rawBody` es el cuerpo
   * exacto que llegó (la firma se calcula sobre él). Debe lanzar
   * `WebhookAuthError` si no puede autenticarla —también si no hay secreto
   * configurado— y devolver `[]` para notificaciones que no importan. Cuando
   * el proveedor solo manda un id (Flow: `token`), aquí se confirma el estado
   * llamando a su API: nunca se confía en el cuerpo.
   */
  parseWebhook(req: Request, rawBody: string): Promise<PaymentEvent[]>
  /** Estado real del pago según el proveedor (para reconciliar al volver del checkout). */
  getPayment(providerPaymentId: string): Promise<ProviderPaymentState>
  /** Reembolsa; sin monto, el total. */
  refund?(providerPaymentId: string, amountMinor?: number): Promise<void>
  createSubscription?(
    input: SubscriptionInput & { notificationUrl: string; successUrl: string }
  ): Promise<ProviderCheckout>
  cancelSubscription?(externalId: string): Promise<void>
}

// ── Errores ──────────────────────────────────────────────────────────────────

/** La notificación no se pudo autenticar. La ruta responde 401 y no escribe nada. */
export class WebhookAuthError extends Error {
  constructor(public readonly reason: string) {
    super(`webhook no autenticado: ${reason}`)
    this.name = "WebhookAuthError"
  }
}

/** Falta configuración del proveedor (llaves). El mensaje nombra la variable, nunca su valor. */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, missing: readonly string[]) {
    super(`${provider} no está configurado: falta ${missing.join(", ")}`)
    this.name = "ProviderNotConfiguredError"
  }
}

/** El proveedor respondió con error. Lleva solo el estado HTTP, nunca el cuerpo (puede traer datos de la persona). */
export class ProviderApiError extends Error {
  constructor(
    public readonly provider: ProviderId,
    public readonly status: number,
    operation: string
  ) {
    super(`${provider}: ${operation} respondió ${status}`)
    this.name = "ProviderApiError"
  }
}

export class OrderAlreadyPaidError extends Error {
  constructor(orderId: string) {
    super(`La orden ${orderId} ya tiene un pago aprobado`)
    this.name = "OrderAlreadyPaidError"
  }
}

/** La orden tiene un pago activo con otros datos: cancélalo (`cancelPayment`) antes de cambiar proveedor o monto. */
export class OrderHasActivePaymentError extends Error {
  constructor(orderId: string) {
    super(
      `La orden ${orderId} ya tiene un pago activo con otro proveedor o monto`
    )
    this.name = "OrderHasActivePaymentError"
  }
}

/** Otro proceso está creando el checkout de esta orden. Reintenta en unos segundos. */
export class CheckoutInProgressError extends Error {
  constructor(orderId: string) {
    super(`El checkout de la orden ${orderId} se está creando`)
    this.name = "CheckoutInProgressError"
  }
}

export type PaymentRecord = {
  id: string
  orderId: string
  provider: ProviderId
  status: PaymentStatus
  amountMinor: number
  currency: string
  refundedMinor: number
  checkoutUrl: string | null
  environment: PaymentsEnvironment
  providerPaymentId: string | null
  createdAt: Date
  approvedAt: Date | null
}

export type ApplyOutcome =
  | "applied" // cambió el estado
  | "noop" // válido, pero no había nada que cambiar
  | "duplicate" // ya procesado: (provider, eventId) existía
  | "amount_mismatch" // el monto o la moneda no cuadran con la orden
  | "unknown_payment" // autenticado, pero no es un pago de esta app
  | "needs_review" // llegó plata que no cuadra con el estado
  | "unknown_subscription"

export type ApplyResult = { eventId: string; outcome: ApplyOutcome }
