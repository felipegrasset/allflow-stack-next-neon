/**
 * payments 0.2 without a database: which subscription entitles (a pending
 * checkout no longer hides an active plan), the subscription state machine
 * (plan changes, scheduled cancellation, stale events) and the refund guard
 * arithmetic. What needs Postgres (the row lock under concurrency) lives in
 * `payments-db.test.ts`.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  pickActiveSubscription,
  subscriptionEntitles,
} from "../contracts/subscriptions"
import {
  ProviderApiError,
  RefundInProgressError,
  SubscriptionChangeError,
  type PaymentEvent,
  type SubscriptionRecord,
} from "../contracts/types"
import { decideSubscription } from "../server/apply"
import { planRefund, refundFailureStatus } from "../server/refund-guard"
import { pickBillable } from "../server/subscriptions"

const NOW = new Date("2026-11-14T12:00:00Z")
const FUTURE = new Date("2026-12-14T12:00:00Z")
const PAST = new Date("2026-10-14T12:00:00Z")

let n = 0
const rec = (over: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  id: `s${++n}`,
  provider: "paddle",
  externalId: `sub_${n}`,
  subscriberRef: "user-1",
  planRef: "pri_basic",
  status: "active",
  currentPeriodEnd: FUTURE,
  cancelAt: null,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...over,
})

// ── getActiveSubscription: the rule ──────────────────────────────────────────

test("subscriptionEntitles: active sí; past_due/canceled solo con fin de período futuro; pending nunca", () => {
  assert.equal(subscriptionEntitles(rec({ currentPeriodEnd: null }), NOW), true)
  assert.equal(subscriptionEntitles(rec({ status: "past_due" }), NOW), true)
  assert.equal(
    subscriptionEntitles(rec({ status: "past_due", currentPeriodEnd: PAST }), NOW),
    false
  )
  assert.equal(subscriptionEntitles(rec({ status: "canceled" }), NOW), true)
  assert.equal(
    subscriptionEntitles(rec({ status: "canceled", currentPeriodEnd: NOW }), NOW),
    false,
    "el fin exacto ya no da derecho"
  )
  assert.equal(
    subscriptionEntitles(rec({ status: "canceled", currentPeriodEnd: null }), NOW),
    false
  )
  assert.equal(subscriptionEntitles(rec({ status: "pending" }), NOW), false)
})

test("el bug: una pending más nueva NO tapa a la active (getSubscription sí lo hacía)", () => {
  const active = rec({ planRef: "pri_pro" })
  const pending = rec({
    status: "pending",
    planRef: "pri_max",
    createdAt: new Date("2026-11-13T00:00:00Z"),
  })
  assert.equal(pickActiveSubscription([pending, active], NOW)?.id, active.id)
  assert.equal(pickActiveSubscription([pending], NOW), null)
})

test("desempate: active > past_due > canceled; luego la más nueva; luego el id mayor", () => {
  const canceledNew = rec({
    status: "canceled",
    createdAt: new Date("2026-11-10T00:00:00Z"),
  })
  const pastDue = rec({ status: "past_due" })
  const activeOld = rec({ createdAt: new Date("2026-01-01T00:00:00Z") })
  assert.equal(
    pickActiveSubscription([canceledNew, pastDue, activeOld], NOW)?.id,
    activeOld.id
  )
  assert.equal(pickActiveSubscription([canceledNew, pastDue], NOW)?.id, pastDue.id)
  const a = rec({ id: "a" })
  const b = rec({ id: "b" })
  assert.equal(pickActiveSubscription([a, b], NOW)?.id, "b")
  const newer = rec({ createdAt: new Date("2026-11-05T00:00:00Z") })
  assert.equal(pickActiveSubscription([a, newer, b], NOW)?.id, newer.id)
})

test("pickBillable (cancelar / cambiar plan por persona): active o past_due; si no, el código dice por qué", () => {
  const pd = rec({ status: "past_due", currentPeriodEnd: PAST })
  const r1 = pickBillable([pd, rec({ status: "pending" })], NOW)
  assert.ok("sub" in r1 && r1.sub.id === pd.id, "past_due vencida aún se puede cancelar")
  const r2 = pickBillable([rec({ status: "canceled" })], NOW)
  assert.ok("error" in r2 && r2.error instanceof SubscriptionChangeError)
  assert.equal(r2.error.code, "already_canceled")
  const r3 = pickBillable([rec({ status: "pending" })], NOW)
  assert.ok("error" in r3 && r3.error.code === "not_found")
})

// ── subscription state machine ───────────────────────────────────────────────

type SubRow = Parameters<typeof decideSubscription>[0]
const row = (over: Partial<SubRow> = {}): SubRow => ({
  status: "active",
  current_period_end: FUTURE,
  plan_ref: "pri_basic",
  cancel_at: null,
  last_event_at: new Date("2026-11-14T10:00:00Z"),
  ...over,
})
const ev = (
  over: Partial<Extract<PaymentEvent, { kind: "subscription" }>> = {}
): Extract<PaymentEvent, { kind: "subscription" }> => ({
  kind: "subscription",
  type: "subscription.active",
  provider: "paddle",
  eventId: "e",
  externalId: "sub_1",
  ...over,
})

test("cambio de plan confirmado por el proveedor: plan_ref cambia", () => {
  const d = decideSubscription(
    row(),
    ev({ planRef: "pri_pro", occurredAt: new Date("2026-11-14T11:00:00Z") })
  )
  assert.equal(d.outcome, "applied")
  assert.equal(d.patch?.plan_ref, "pri_pro")
  assert.equal(d.patch?.last_event_at?.toISOString(), "2026-11-14T11:00:00.000Z")
})

test("un evento más viejo que el último aplicado no revierte el plan", () => {
  const d = decideSubscription(
    row({ plan_ref: "pri_pro" }),
    ev({ planRef: "pri_basic", occurredAt: new Date("2026-11-14T09:00:00Z") })
  )
  assert.deepEqual(d, { outcome: "noop", patch: null })
})

test("cancelación programada: se guarda con su fecha, y se limpia con null; undefined no toca", () => {
  const set = decideSubscription(row(), ev({ cancelAt: FUTURE }))
  assert.equal(set.outcome, "applied")
  assert.equal(set.patch?.cancel_at, FUTURE)
  assert.equal(set.patch?.status, undefined, "sigue active hasta el fin del período")
  const clear = decideSubscription(row({ cancel_at: FUTURE }), ev({ cancelAt: null }))
  assert.equal(clear.patch?.cancel_at, null)
  assert.deepEqual(decideSubscription(row({ cancel_at: FUTURE }), ev()), {
    outcome: "noop",
    patch: null,
  })
})

test("canceled sigue siendo terminal; un evento idéntico es noop", () => {
  assert.deepEqual(
    decideSubscription(row({ status: "canceled" }), ev({ planRef: "pri_pro" })),
    { outcome: "noop", patch: null }
  )
  assert.equal(
    decideSubscription(row(), ev({ currentPeriodEnd: new Date(FUTURE) })).outcome,
    "noop"
  )
  assert.equal(
    decideSubscription(row(), ev({ type: "subscription.canceled" })).patch?.status,
    "canceled"
  )
})

// ── refund guard ─────────────────────────────────────────────────────────────

const base = { paymentId: "pay-1", amountMinor: 15000, refundedMinor: 0 }

test("doble reembolso: el segundo pedido por el mismo monto pendiente se rechaza con RefundInProgressError", () => {
  const first = planRefund({ ...base, openExpectedTotals: [], requestedMinor: 10000 })
  assert.deepEqual(first, { reserveMinor: 10000, expectedTotalMinor: 10000 })
  assert.throws(
    () =>
      planRefund({
        ...base,
        openExpectedTotals: [first.expectedTotalMinor],
        requestedMinor: 10000,
      }),
    (e: unknown) => e instanceof RefundInProgressError && e.availableMinor === 5000
  )
  // lo que queda libre sí cabe
  assert.deepEqual(
    planRefund({ ...base, openExpectedTotals: [10000], requestedMinor: 5000 }),
    { reserveMinor: 5000, expectedTotalMinor: 15000 }
  )
})

test("reembolso total con otro pendiente: RefundInProgressError; sin pendientes reserva todo lo que queda", () => {
  assert.throws(
    () => planRefund({ ...base, openExpectedTotals: [3000] }),
    RefundInProgressError
  )
  assert.deepEqual(
    planRefund({ ...base, refundedMinor: 3000, openExpectedTotals: [3000] }),
    { reserveMinor: 12000, expectedTotalMinor: 15000 },
    "un pedido ya confirmado (expected <= refunded) no cuenta"
  )
})

test("confirmaciones fuera de orden: lo reservado se calcula contra el mayor total esperado", () => {
  // A (5000, espera 5000) y B (3000, espera 8000) abiertos; se confirma B primero (refunded 3000)
  assert.throws(
    () =>
      planRefund({
        ...base,
        refundedMinor: 3000,
        openExpectedTotals: [5000, 8000],
        requestedMinor: 7001,
      }),
    RefundInProgressError
  )
  assert.equal(
    planRefund({
      ...base,
      refundedMinor: 3000,
      openExpectedTotals: [5000, 8000],
      requestedMinor: 7000,
    }).expectedTotalMinor,
    15000
  )
})

test("monto imposible sigue siendo «Monto de reembolso inválido» (no RefundInProgressError)", () => {
  for (const requestedMinor of [0, -1, 1.5, 15001]) {
    assert.throws(
      () => planRefund({ ...base, openExpectedTotals: [], requestedMinor }),
      (e: unknown) => e instanceof Error && !(e instanceof RefundInProgressError) && /inválido/.test(e.message)
    )
  }
  assert.throws(() => planRefund({ ...base, refundedMinor: 15000, openExpectedTotals: [] }), /inválido/)
})

test("tras un error del proveedor: 4xx o error previo liberan; red, 5xx o 2xx ilegible quedan reservados", () => {
  assert.equal(refundFailureStatus(new Error("validación local")), "failed")
  assert.equal(refundFailureStatus(new ProviderApiError("paddle", 400, "refund")), "failed")
  assert.equal(refundFailureStatus(new ProviderApiError("paddle", 422, "refund")), "failed")
  assert.equal(refundFailureStatus(new ProviderApiError("paddle", 0, "refund")), "unknown")
  assert.equal(refundFailureStatus(new ProviderApiError("paddle", 502, "refund")), "unknown")
  assert.equal(refundFailureStatus(new ProviderApiError("mercadopago", 201, "refund (json)")), "unknown")
})
