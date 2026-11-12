import type { Kysely, Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  checkoutInputSchema,
  subscriptionInputSchema,
} from "../contracts/input"
import {
  ACTIVE_STATUSES,
  CheckoutInProgressError,
  OrderAlreadyPaidError,
  OrderHasActivePaymentError,
  type CheckoutInput,
  type PaymentRecord,
  type PaymentStatus,
  type ProviderCheckout,
  type SubscriptionInput,
} from "../contracts/types"
import type { PaymentsTable } from "../db/types"

import { applyEvent } from "./apply"
import { appBaseUrl, paymentsEnvironment, webhookUrl, type Env } from "./config"
import { getProvider, resolveProvider } from "./registry"

/** Entorno y, en pruebas, el registro de proveedores. Nunca llega de una petición. */
export type CheckoutDeps = {
  env?: Env
  getProvider?: typeof getProvider
  resolveProvider?: typeof resolveProvider
}

type Db = Kysely<Database>
type PaymentRow = Selectable<PaymentsTable>

export function toRecord(r: PaymentRow): PaymentRecord {
  return {
    id: r.id,
    orderId: r.order_id,
    provider: r.provider,
    status: r.status as PaymentStatus,
    amountMinor: Number(r.amount_minor),
    currency: r.currency.trim(),
    refundedMinor: Number(r.refunded_minor),
    checkoutUrl: r.checkout_url,
    environment: r.environment,
    providerPaymentId: r.provider_payment_id,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
  }
}

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  (e as { code?: string }).code === "23505"

const returnUrls = (base: string, returnPath: string) => ({
  successUrl: `${base}${returnPath}`,
  failureUrl: `${base}${returnPath}`,
  pendingUrl: `${base}${returnPath}`,
})

/**
 * Crea (o reutiliza) el checkout de una orden. Solo desde código de servidor:
 * `amountMinor` lo calcula la app a partir de SU orden, jamás viene del
 * navegador, y es contra esa cifra que el webhook compara (PAY-5).
 *
 * - Orden ya pagada → `OrderAlreadyPaidError`.
 * - Orden con un checkout vivo del mismo proveedor, monto y moneda → devuelve el mismo enlace.
 * - Orden con un pago activo distinto → `OrderHasActivePaymentError`: `cancelPayment` primero.
 */
export async function startCheckout(
  db: Db,
  rawInput: CheckoutInput,
  deps: CheckoutDeps = {}
): Promise<{ paymentId: string; url: string; reused: boolean }> {
  const env = deps.env ?? process.env
  const input = checkoutInputSchema.parse(rawInput)
  const provider = await (deps.resolveProvider ?? resolveProvider)(
    input.provider,
    env
  )
  const environment = paymentsEnvironment(env)
  const base = appBaseUrl(env)

  const existing = await findActive(db, input.orderId)
  if (existing) return reuse(existing, input, provider.id)

  const id = crypto.randomUUID()
  try {
    await db
      .insertInto("payments")
      .values({
        id,
        order_id: input.orderId,
        provider: provider.id,
        environment,
        amount_minor: input.amountMinor,
        currency: input.currency,
        description: input.description,
        payer_email: input.payerEmail ?? null,
      })
      .execute()
  } catch (e) {
    // Otro proceso ganó la carrera por la misma orden: el índice único parcial lo decidió.
    if (!isUniqueViolation(e)) throw e
    const winner = await findActive(db, input.orderId)
    if (!winner) throw e
    return reuse(winner, input, provider.id)
  }

  // La llamada de red va FUERA de la transacción: no se retiene una conexión mientras el proveedor responde.
  let checkout: ProviderCheckout
  try {
    checkout = await provider.createCheckout({
      paymentId: id,
      orderId: input.orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      description: input.description,
      payerEmail: input.payerEmail,
      notificationUrl: webhookUrl(provider.id, env),
      environment,
      ...returnUrls(base, input.returnPath),
    })
  } catch (e) {
    // No existe checkout remoto: se libera la orden para reintentar.
    await db
      .updateTable("payments")
      .set({ status: "canceled", updated_at: new Date() })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute()
    throw e
  }
  await db
    .updateTable("payments")
    .set({
      external_id: checkout.id,
      checkout_url: checkout.url,
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .execute()
  return { paymentId: id, url: checkout.url, reused: false }
}

async function findActive(db: Db, orderId: string) {
  return db
    .selectFrom("payments")
    .selectAll()
    .where("order_id", "=", orderId)
    .where("status", "in", [...ACTIVE_STATUSES])
    .executeTakeFirst()
}

function reuse(
  existing: PaymentRow,
  input: { orderId: string; amountMinor: number; currency: string },
  providerId: string
): { paymentId: string; url: string; reused: true } {
  if (existing.status === "approved")
    throw new OrderAlreadyPaidError(input.orderId)
  const same =
    existing.provider === providerId &&
    Number(existing.amount_minor) === input.amountMinor &&
    existing.currency.trim() === input.currency
  if (!same || existing.status === "needs_review") {
    throw new OrderHasActivePaymentError(input.orderId)
  }
  if (!existing.checkout_url) throw new CheckoutInProgressError(input.orderId)
  return { paymentId: existing.id, url: existing.checkout_url, reused: true }
}

/** El pago activo de una orden, o el último si ninguno está activo. */
export async function getPaymentByOrder(
  db: Db,
  orderId: string
): Promise<PaymentRecord | null> {
  const row = await db
    .selectFrom("payments")
    .selectAll()
    .where("order_id", "=", orderId)
    .orderBy("created_at", "desc")
    .executeTakeFirst()
  return row ? toRecord(row) : null
}

/**
 * La app abandona un checkout (cambió de proveedor, de monto, o la persona se
 * arrepintió). Solo pasa de pending/failed a canceled; si después llega plata
 * sobre él, el evento lo manda a `needs_review`, no a approved.
 */
export async function cancelPayment(
  db: Db,
  paymentId: string
): Promise<boolean> {
  const res = await db
    .updateTable("payments")
    .set({ status: "canceled", updated_at: new Date() })
    .where("id", "=", paymentId)
    .where("status", "in", ["pending", "failed"])
    .executeTakeFirst()
  return Number(res.numUpdatedRows) > 0
}

/**
 * Reconcilia un pago con lo que dice el proveedor, consultando su API con la
 * llave del servidor. Es lo que corre la página a la que vuelve la persona
 * (antes de que llegue el webhook) y la única vía en el sandbox de Mercado
 * Pago, que no envía webhooks con credenciales de prueba.
 *
 * `providerRef` puede venir del navegador (`?payment_id=`): no se confía en él,
 * solo se usa para preguntarle al proveedor, y el resultado debe apuntar a ESTE
 * pago o se rechaza.
 */
export async function syncPayment(
  db: Db,
  paymentId: string,
  providerRef?: string,
  deps: CheckoutDeps = {}
): Promise<PaymentRecord> {
  const env = deps.env ?? process.env
  const row = await db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", paymentId)
    .executeTakeFirst()
  if (!row) throw new Error("Pago desconocido")
  const ref = providerRef ?? row.provider_payment_id ?? row.external_id
  if (!ref) throw new Error("El pago aún no tiene referencia en el proveedor")

  const provider = await (deps.getProvider ?? getProvider)(row.provider, env)
  const state = await provider.getPayment(ref)
  const belongs =
    state.paymentId === row.id ||
    (state.paymentId === undefined &&
      (state.providerPaymentId === row.provider_payment_id ||
        state.providerPaymentId === row.external_id))
  if (!belongs) throw new Error("La referencia no corresponde a este pago")

  const eventId = `sync:${state.providerPaymentId}:${state.status}:${state.refundedMinor ?? 0}`
  const base = {
    provider: provider.id,
    eventId,
    paymentId: row.id,
    providerPaymentId: state.providerPaymentId,
    kind: "payment" as const,
  }
  if (state.status === "approved" || state.status === "refunded") {
    if (state.amountMinor === undefined || !state.currency) {
      throw new Error("El proveedor no informó el monto: no se puede conciliar")
    }
    await applyEvent(db, {
      ...base,
      type: "payment.approved",
      amountMinor: state.amountMinor,
      currency: state.currency,
    })
    if (state.status === "refunded" || (state.refundedMinor ?? 0) > 0) {
      await applyEvent(db, {
        ...base,
        eventId: `${eventId}:refund`,
        type: "payment.refunded",
        refundedMinor: state.refundedMinor ?? state.amountMinor,
      })
    }
  } else {
    await applyEvent(db, {
      ...base,
      type: state.status === "pending" ? "payment.pending" : "payment.failed",
    })
  }
  const fresh = await db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", paymentId)
    .executeTakeFirstOrThrow()
  return toRecord(fresh)
}

/**
 * Pide el reembolso al proveedor. No cambia el estado aquí: el cambio llega por
 * el webhook de reembolso o por `syncPayment`, que es lo que el proveedor
 * confirma de verdad.
 */
export async function refundPayment(
  db: Db,
  paymentId: string,
  amountMinor?: number,
  deps: CheckoutDeps = {}
): Promise<void> {
  const env = deps.env ?? process.env
  const row = await db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", paymentId)
    .executeTakeFirst()
  if (!row || row.status !== "approved" || !row.provider_payment_id) {
    throw new Error("Solo se reembolsa un pago aprobado")
  }
  const remaining = Number(row.amount_minor) - Number(row.refunded_minor)
  if (amountMinor !== undefined) {
    if (
      !Number.isInteger(amountMinor) ||
      amountMinor <= 0 ||
      amountMinor > remaining
    ) {
      throw new Error("Monto de reembolso inválido")
    }
  }
  const provider = await (deps.getProvider ?? getProvider)(row.provider, env)
  if (!provider.refund)
    throw new Error(`${provider.id} no soporta reembolsos desde aquí`)
  await provider.refund(row.provider_payment_id, amountMinor)
}

/** Inicia una suscripción en el proveedor y deja la fila `pending`; el webhook la activa. */
export async function startSubscription(
  db: Db,
  rawInput: SubscriptionInput,
  deps: CheckoutDeps = {}
): Promise<{ url: string; externalId: string }> {
  const env = deps.env ?? process.env
  const input = subscriptionInputSchema.parse(rawInput)
  const provider = await (deps.resolveProvider ?? resolveProvider)(
    input.provider,
    env
  )
  if (!provider.createSubscription) {
    throw new Error(`${provider.id} no soporta suscripciones`)
  }
  const base = appBaseUrl(env)
  const created = await provider.createSubscription({
    ...input,
    notificationUrl: webhookUrl(provider.id, env),
    successUrl: `${base}${input.returnPath}`,
  })
  await db
    .insertInto("payments_subscriptions")
    .values({
      id: crypto.randomUUID(),
      provider: provider.id,
      external_id: created.id,
      subscriber_ref: input.subscriberRef,
      plan_ref: input.planRef,
    })
    .onConflict((oc) => oc.columns(["provider", "external_id"]).doNothing())
    .execute()
  return { url: created.url, externalId: created.id }
}

/** Suscripción más reciente de una persona de la app. */
export async function getSubscription(db: Db, subscriberRef: string) {
  return db
    .selectFrom("payments_subscriptions")
    .selectAll()
    .where("subscriber_ref", "=", subscriberRef)
    .orderBy("created_at", "desc")
    .executeTakeFirst()
}
