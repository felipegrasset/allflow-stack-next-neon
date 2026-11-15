import type { Kysely, Selectable, Transaction } from "kysely"

import type { Database } from "@/server/db/schema"

import type {
  ApplyOutcome,
  ApplyResult,
  PaymentEvent,
  PaymentStatus,
} from "../contracts/types"
import type { PaymentsSubscriptionsTable, PaymentsTable } from "../db/types"

type PaymentRow = Selectable<PaymentsTable>
type Db = Kysely<Database>

/** Lo que una decisión cambia del pago. `null` = nada. */
export type PaymentPatch = {
  status?: PaymentStatus
  refundedMinor?: number
  approvedNow?: boolean
  providerPaymentId?: string
}

export type Decision = { outcome: ApplyOutcome; patch: PaymentPatch | null }

const noop: Decision = { outcome: "noop", patch: null }

/**
 * La máquina de estados, pura: (pago, evento autenticado) → qué hacer. Sin base
 * de datos para poder probarla entera.
 *
 *   pending|failed ──approved──▶ approved ──refunded──▶ refunded
 *   pending ◀──────pending───── failed        (un reintento en la misma preferencia)
 *   canceled ──approved──▶ needs_review       (llegó plata sobre un checkout abandonado)
 *
 * Lo aprobado nunca baja a pending/failed por un evento tardío o repetido.
 */
export function decidePayment(
  pay: Pick<
    PaymentRow,
    | "status"
    | "amount_minor"
    | "currency"
    | "refunded_minor"
    | "provider_payment_id"
  >,
  ev: Extract<PaymentEvent, { kind: "payment" }>
): Decision {
  const status = pay.status as PaymentStatus
  const amount = Number(pay.amount_minor)

  switch (ev.type) {
    case "payment.approved": {
      // PAY-5: el monto de la orden manda; el del proveedor solo se compara.
      const same =
        ev.amountMinor === amount &&
        ev.currency.toUpperCase() === pay.currency.trim().toUpperCase()
      if (status === "pending" || status === "failed") {
        if (!same) {
          return {
            outcome: "amount_mismatch",
            patch: {
              status: "needs_review",
              providerPaymentId: ev.providerPaymentId,
            },
          }
        }
        return {
          outcome: "applied",
          patch: {
            status: "approved",
            approvedNow: true,
            providerPaymentId: ev.providerPaymentId,
          },
        }
      }
      if (status === "canceled") {
        return {
          outcome: "needs_review",
          patch: {
            status: "needs_review",
            providerPaymentId: ev.providerPaymentId,
          },
        }
      }
      // Ya aprobado y llega OTRO pago aprobado para la misma orden: se cobró dos
      // veces. No se toca el estado (la orden sigue pagada), pero queda marcado.
      if (
        status === "approved" &&
        pay.provider_payment_id &&
        pay.provider_payment_id !== ev.providerPaymentId
      ) {
        return { outcome: "needs_review", patch: null }
      }
      return same ? noop : { outcome: "amount_mismatch", patch: null }
    }

    case "payment.pending":
      return status === "failed"
        ? { outcome: "applied", patch: { status: "pending" } }
        : noop

    case "payment.failed":
      return status === "pending"
        ? { outcome: "applied", patch: { status: "failed" } }
        : noop

    case "payment.refunded": {
      if (status === "approved" || status === "refunded") {
        const refunded = Math.max(Number(pay.refunded_minor), ev.refundedMinor)
        if (refunded > amount) {
          return { outcome: "needs_review", patch: { status: "needs_review" } }
        }
        const next: PaymentStatus =
          refunded === amount ? "refunded" : "approved"
        if (refunded === Number(pay.refunded_minor) && next === status)
          return noop
        return {
          outcome: "applied",
          patch: { refundedMinor: refunded, status: next },
        }
      }
      // Un reembolso sobre algo que nunca se aprobó: que lo mire una persona.
      return status === "needs_review"
        ? noop
        : { outcome: "needs_review", patch: { status: "needs_review" } }
    }
  }
}

async function applyPayment(
  trx: Transaction<Database>,
  ev: Extract<PaymentEvent, { kind: "payment" }>
): Promise<{ outcome: ApplyOutcome; paymentId: string | null }> {
  // El pago se busca por id de la app y SIEMPRE dentro del mismo proveedor:
  // un evento de Mercado Pago no puede mover un pago de Flow.
  let pay: PaymentRow | undefined
  if (ev.paymentId) {
    pay = await trx
      .selectFrom("payments")
      .selectAll()
      .where("id", "=", ev.paymentId)
      .where("provider", "=", ev.provider)
      .forUpdate()
      .executeTakeFirst()
  }
  if (!pay) {
    pay = await trx
      .selectFrom("payments")
      .selectAll()
      .where("provider", "=", ev.provider)
      .where((eb) =>
        eb.or([
          eb("provider_payment_id", "=", ev.providerPaymentId),
          eb("external_id", "=", ev.providerPaymentId),
        ])
      )
      .orderBy("created_at", "desc")
      .forUpdate()
      .executeTakeFirst()
  }
  if (!pay) return { outcome: "unknown_payment", paymentId: null }

  const { outcome, patch } = decidePayment(pay, ev)
  if (patch) {
    await trx
      .updateTable("payments")
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.refundedMinor !== undefined
          ? { refunded_minor: patch.refundedMinor }
          : {}),
        ...(patch.providerPaymentId
          ? { provider_payment_id: patch.providerPaymentId }
          : {}),
        ...(patch.approvedNow ? { approved_at: new Date() } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", pay.id)
      .execute()
  }
  return { outcome, paymentId: pay.id }
}

type SubscriptionRow = Selectable<PaymentsSubscriptionsTable>
type SubscriptionEvent = Extract<PaymentEvent, { kind: "subscription" }>

/** What a subscription event changes. `null` fields are not in the patch: absent = unchanged. */
export type SubscriptionPatch = {
  status?: "active" | "past_due" | "canceled"
  current_period_end?: Date
  plan_ref?: string
  cancel_at?: Date | null
  last_event_at?: Date
}

const sameTime = (a: Date | null, b: Date | null | undefined) =>
  (a === null && (b === null || b === undefined)) ||
  (a !== null && b instanceof Date && a.getTime() === b.getTime())

/**
 * Pure: (stored subscription, authenticated event) → what to write.
 *
 * - `canceled` is terminal: a late event does not revive it.
 * - An event older than the last applied one (`occurredAt < last_event_at`,
 *   when both exist) changes nothing: a delayed old event cannot roll back a
 *   plan change.
 * - Otherwise status, period end, plan (`planRef`) and scheduled cancellation
 *   (`cancelAt`) follow the event; what the event does not carry stays.
 */
export function decideSubscription(
  sub: Pick<
    SubscriptionRow,
    "status" | "current_period_end" | "plan_ref" | "cancel_at" | "last_event_at"
  >,
  ev: SubscriptionEvent
): { outcome: "applied" | "noop"; patch: SubscriptionPatch | null } {
  const status = ev.type.slice("subscription.".length) as
    "active" | "past_due" | "canceled"
  if (sub.status === "canceled") return { outcome: "noop", patch: null }
  const at = ev.occurredAt
  if (at && sub.last_event_at && at.getTime() < sub.last_event_at.getTime())
    return { outcome: "noop", patch: null }

  const patch: SubscriptionPatch = {}
  if (sub.status !== status) patch.status = status
  if (ev.currentPeriodEnd && !sameTime(sub.current_period_end, ev.currentPeriodEnd))
    patch.current_period_end = ev.currentPeriodEnd
  if (ev.planRef && ev.planRef !== sub.plan_ref) patch.plan_ref = ev.planRef
  if (ev.cancelAt !== undefined && !sameTime(sub.cancel_at, ev.cancelAt))
    patch.cancel_at = ev.cancelAt
  const changed = Object.keys(patch).length > 0
  if (at && (!sub.last_event_at || at.getTime() > sub.last_event_at.getTime()))
    patch.last_event_at = at
  return {
    outcome: changed ? "applied" : "noop",
    patch: Object.keys(patch).length > 0 ? patch : null,
  }
}

async function applySubscription(
  trx: Transaction<Database>,
  ev: SubscriptionEvent
): Promise<{ outcome: ApplyOutcome }> {
  const status = ev.type.slice("subscription.".length) as
    "active" | "past_due" | "canceled"
  const sub = await trx
    .selectFrom("payments_subscriptions")
    .selectAll()
    .where("provider", "=", ev.provider)
    .where("external_id", "=", ev.externalId)
    .forUpdate()
    .executeTakeFirst()

  if (!sub) {
    if (!ev.subscriberRef) return { outcome: "unknown_subscription" }
    await trx
      .insertInto("payments_subscriptions")
      .values({
        id: crypto.randomUUID(),
        provider: ev.provider,
        external_id: ev.externalId,
        subscriber_ref: ev.subscriberRef,
        plan_ref: ev.planRef ?? null,
        status,
        current_period_end: ev.currentPeriodEnd ?? null,
        cancel_at: ev.cancelAt ?? null,
        last_event_at: ev.occurredAt ?? null,
      })
      .execute()
    return { outcome: "applied" }
  }
  const { outcome, patch } = decideSubscription(sub, ev)
  if (patch) {
    await trx
      .updateTable("payments_subscriptions")
      .set({ ...patch, updated_at: new Date() })
      .where("id", "=", sub.id)
      .execute()
  }
  return { outcome }
}

const isMinor = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0

/** Un proveedor mal escrito no debe poder meter NaN, decimales o negativos en la base. */
function assertEvent(ev: PaymentEvent): void {
  if (!ev.eventId || ev.eventId.length > 200)
    throw new Error("eventId inválido")
  if (ev.kind !== "payment") return
  if (
    "amountMinor" in ev &&
    ev.amountMinor !== undefined &&
    !isMinor(ev.amountMinor)
  ) {
    throw new Error("amountMinor inválido")
  }
  if (ev.type === "payment.refunded" && !isMinor(ev.refundedMinor)) {
    throw new Error("refundedMinor inválido")
  }
}

/**
 * Aplica UN evento ya autenticado, en una transacción interactiva (Pool por
 * WebSocket en Neon; el driver HTTP no sirve: aquí se lee y se escribe según
 * lo leído).
 *
 * El insert en `payments_events` es el candado: `(provider, event_id)` único.
 * Si ya existía, el evento se procesó antes y no se toca nada (PAY-2). El
 * insert y el cambio de estado viajan en la MISMA transacción: si algo falla a
 * medias, todo se revierte y el reintento del proveedor reprocesa limpio.
 */
export async function applyEvent(
  db: Db,
  ev: PaymentEvent
): Promise<ApplyResult> {
  assertEvent(ev)
  return db.transaction().execute(async (trx) => {
    const lock = await trx
      .insertInto("payments_events")
      .values({
        id: crypto.randomUUID(),
        provider: ev.provider,
        event_id: ev.eventId,
        type: ev.type,
        outcome: "processing",
        amount_minor:
          ev.kind === "payment" &&
          "amountMinor" in ev &&
          ev.amountMinor !== undefined
            ? ev.amountMinor
            : null,
        currency:
          ev.kind === "payment" && "currency" in ev && ev.currency
            ? ev.currency.toUpperCase()
            : null,
      })
      .onConflict((oc) => oc.columns(["provider", "event_id"]).doNothing())
      .returning("id")
      .executeTakeFirst()
    if (!lock) return { eventId: ev.eventId, outcome: "duplicate" as const }

    const res =
      ev.kind === "payment"
        ? await applyPayment(trx, ev)
        : { ...(await applySubscription(trx, ev)), paymentId: null }

    await trx
      .updateTable("payments_events")
      .set({ outcome: res.outcome, payment_id: res.paymentId })
      .where("id", "=", lock.id)
      .execute()
    return { eventId: ev.eventId, outcome: res.outcome }
  })
}

/** Cada evento en su transacción: uno malo no arrastra a los demás de la misma notificación. */
export async function applyEvents(
  db: Db,
  events: readonly PaymentEvent[]
): Promise<ApplyResult[]> {
  const out: ApplyResult[] = []
  for (const ev of events) out.push(await applyEvent(db, ev))
  return out
}
