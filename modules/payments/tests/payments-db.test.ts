/**
 * payments contra Postgres de verdad: idempotencia bajo concurrencia,
 * atomicidad, la carrera por una orden y el ciclo de vida completo. Crea su
 * propio schema (no toca tablas de la app) y lo borra al terminar.
 *
 * Sin DATABASE_URL se salta —y lo dice—; el CI tiene un postgres:16.
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import {
  Kysely,
  PostgresDialect,
  type KyselyPlugin,
  type RootOperationNode,
} from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { up } from "../db/migrations/0101_payments_init"
import { up as up0124 } from "../db/migrations/0124_payments_refund_guard"
import {
  OperationNotSupportedError,
  OrderAlreadyPaidError,
  OrderHasActivePaymentError,
  ProviderApiError,
  RefundInProgressError,
  SubscriptionChangeError,
  type PaymentEvent,
  type PaymentProvider,
} from "../contracts/types"
import { applyEvent, applyEvents } from "../server/apply"
import {
  cancelPayment,
  getPaymentByOrder,
  refundPayment,
  startCheckout,
  startSubscription,
  syncPayment,
  getSubscription,
  type CheckoutDeps,
} from "../server/checkout"
import {
  cancelSubscription,
  changeSubscriptionPlan,
  getActiveSubscription,
  listSubscriptions,
} from "../server/subscriptions"

const url = process.env.DATABASE_URL
const skip = url
  ? false
  : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `payments_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const ENV = { BETTER_AUTH_URL: "https://app.test", PAYMENTS_ENV: "sandbox" }

let pool: pg.Pool
let db: Kysely<Database>

/** Un plugin que hace fallar todo UPDATE de `payments` mientras `armed`: simula una caída a medias. */
let failUpdates = false
/** Y uno que deja ciega la PRIMERA lectura de `payments` (una lectura obsoleta): fuerza la carrera sin depender del azar. */
let blindNextPaymentsRead = false
const blinded = new Set<unknown>()
const failingPlugin: KyselyPlugin = {
  transformQuery({ node, queryId }) {
    const kind = (node as RootOperationNode).kind
    if (failUpdates && kind === "UpdateQueryNode") {
      if (JSON.stringify(node).includes('"payments"'))
        throw new Error("caída simulada a medias")
    }
    if (
      blindNextPaymentsRead &&
      kind === "SelectQueryNode" &&
      JSON.stringify(node).includes('"payments"')
    ) {
      blindNextPaymentsRead = false
      blinded.add(queryId)
    }
    return node
  },
  async transformResult({ result, queryId }) {
    return blinded.delete(queryId) ? { ...result, rows: [] } : result
  },
}

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 8 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}`))
  db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [failingPlugin],
  })
  await up(db as unknown as Kysely<unknown>)
  await up0124(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

const SAMPLE_TEXT = "Pedido de prueba"
const mk = (n: string) => ({
  orderId: `order-${n}-${Math.random().toString(36).slice(2, 8)}`,
  amountMinor: 15000,
  currency: "CLP",
  description: SAMPLE_TEXT,
  returnPath: "/orders/1",
})

type Fake = PaymentProvider & { calls: { checkout: number; refunds: number[] } }
function fakeProvider(
  opts: {
    failCheckout?: boolean
    state?: Awaited<ReturnType<PaymentProvider["getPayment"]>>
  } = {}
): Fake {
  const calls = { checkout: 0, refunds: [] as number[] }
  return {
    id: "mercadopago",
    calls,
    createCheckout: async (input) => {
      calls.checkout++
      if (opts.failCheckout)
        throw new ProviderApiError("mercadopago", 500, "createCheckout")
      assert.match(
        input.notificationUrl,
        /^https:\/\/app\.test\/api\/payments\/webhook\/mercadopago$/
      )
      assert.equal(input.environment, "sandbox")
      return {
        id: `pref-${input.paymentId}`,
        url: `https://checkout.test/${input.paymentId}`,
      }
    },
    parseWebhook: async () => [],
    getPayment: async () => {
      if (!opts.state) throw new Error("sin estado")
      return opts.state
    },
    refund: async (_id, amount) => void calls.refunds.push(amount ?? -1),
  }
}
const depsFor = (p: PaymentProvider): CheckoutDeps => ({
  env: ENV,
  resolveProvider: async () => p,
  getProvider: async () => p,
})

const approvedEv = (
  paymentId: string,
  over: Partial<Extract<PaymentEvent, { type: "payment.approved" }>> = {}
): PaymentEvent => ({
  kind: "payment",
  type: "payment.approved",
  provider: "mercadopago",
  eventId: `evt-${paymentId}`,
  paymentId,
  providerPaymentId: "mp-100",
  amountMinor: 15000,
  currency: "CLP",
  ...over,
})

async function events(paymentId: string) {
  return db
    .selectFrom("payments_events")
    .selectAll()
    .where("payment_id", "=", paymentId)
    .execute()
}

// ── PAY-2: el mismo evento, muchas veces ─────────────────────────────────────

test(
  "PAY-2: el mismo evento 5 veces EN PARALELO deja un solo cambio",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(db, mk("idem"), depsFor(p))
    const ev = approvedEv(paymentId)

    const results = await Promise.all(
      Array.from({ length: 5 }, () => applyEvent(db, ev))
    )

    assert.equal(results.filter((r) => r.outcome === "applied").length, 1)
    assert.equal(results.filter((r) => r.outcome === "duplicate").length, 4)
    assert.equal(
      (await events(paymentId)).length,
      1,
      "un solo registro de evento"
    )
    const pay = await getPaymentByOrder(
      db,
      (
        await db
          .selectFrom("payments")
          .select("order_id")
          .where("id", "=", paymentId)
          .executeTakeFirstOrThrow()
      ).order_id
    )
    assert.equal(pay?.status, "approved")
  }
)

test(
  "PAY-2: repetido en secuencia, el reembolso tampoco se suma dos veces",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(
      db,
      mk("refund-twice"),
      depsFor(p)
    )
    await applyEvent(db, approvedEv(paymentId))
    const ref: PaymentEvent = {
      kind: "payment",
      type: "payment.refunded",
      provider: "mercadopago",
      eventId: "ref-1",
      paymentId,
      providerPaymentId: "mp-100",
      refundedMinor: 5000,
    }
    const out = await applyEvents(db, [ref, ref, ref])
    assert.deepEqual(
      out.map((o) => o.outcome),
      ["applied", "duplicate", "duplicate"]
    )
    const row = await db
      .selectFrom("payments")
      .selectAll()
      .where("id", "=", paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(Number(row.refunded_minor), 5000)
    assert.equal(row.status, "approved")
  }
)

// ── atomicidad: el candado y el cambio viajan juntos ─────────────────────────

test(
  "si cae a medias, el candado se revierte y el reintento sí procesa",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(db, mk("atomic"), depsFor(p))
    const ev = approvedEv(paymentId)

    failUpdates = true
    await assert.rejects(() => applyEvent(db, ev), /caída simulada/)
    failUpdates = false

    assert.equal(
      (await events(paymentId)).length,
      0,
      "el registro del evento se revirtió"
    )
    const mid = await db
      .selectFrom("payments")
      .select("status")
      .where("id", "=", paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(mid.status, "pending")

    // el proveedor reintenta: ahora sí
    assert.equal((await applyEvent(db, ev)).outcome, "applied")
  }
)

// ── PAY-5 contra la base ─────────────────────────────────────────────────────

test(
  "PAY-5: un webhook por otro monto deja el pago en needs_review",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(db, mk("mismatch"), depsFor(p))
    const r = await applyEvent(db, approvedEv(paymentId, { amountMinor: 100 }))
    assert.equal(r.outcome, "amount_mismatch")
    const row = await db
      .selectFrom("payments")
      .selectAll()
      .where("id", "=", paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "needs_review")
    assert.equal(row.approved_at, null)
  }
)

test(
  "un evento de otro proveedor no puede mover un pago ajeno",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(db, mk("cross"), depsFor(p))
    const r = await applyEvent(
      db,
      approvedEv(paymentId, { provider: "flow", eventId: "flow-1" })
    )
    assert.equal(r.outcome, "unknown_payment")
    const row = await db
      .selectFrom("payments")
      .select("status")
      .where("id", "=", paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "pending")
  }
)

test(
  "un pago desconocido queda registrado pero no inventa un pago",
  { skip },
  async () => {
    const r = await applyEvent(
      db,
      approvedEv("no-existe", {
        eventId: "ghost-1",
        providerPaymentId: "mp-ghost",
      })
    )
    assert.equal(r.outcome, "unknown_payment")
  }
)

test(
  "un evento mal formado (NaN, decimal) se rechaza antes de abrir la transacción",
  { skip },
  async () => {
    const p = fakeProvider()
    const { paymentId } = await startCheckout(db, mk("bad"), depsFor(p))
    await assert.rejects(
      () =>
        applyEvent(
          db,
          approvedEv(paymentId, { amountMinor: Number.NaN, eventId: "nan" })
        ),
      /amountMinor/
    )
    await assert.rejects(
      () =>
        applyEvent(
          db,
          approvedEv(paymentId, { amountMinor: 1.5, eventId: "dec" })
        ),
      /amountMinor/
    )
    assert.equal((await events(paymentId)).length, 0)
  }
)

// ── startCheckout ────────────────────────────────────────────────────────────

test(
  "dos startCheckout simultáneos para la misma orden terminan con UN pago y UN enlace",
  { skip },
  async () => {
    const p = fakeProvider()
    const input = mk("race")
    const settled = await Promise.allSettled([
      startCheckout(db, input, depsFor(p)),
      startCheckout(db, input, depsFor(p)),
      startCheckout(db, input, depsFor(p)),
    ])
    const rows = await db
      .selectFrom("payments")
      .select("id")
      .where("order_id", "=", input.orderId)
      .execute()
    assert.equal(rows.length, 1, "el índice único parcial deja una sola fila")
    assert.equal(
      p.calls.checkout,
      1,
      "se creó un solo checkout en el proveedor"
    )
    const urls = settled.flatMap((s) =>
      s.status === "fulfilled" ? [s.value.url] : []
    )
    assert.ok(urls.length >= 1)
    assert.equal(new Set(urls).size, 1)
  }
)

test(
  "el índice único parcial: la base rechaza dos pagos activos de una orden (y deja pasar uno cancelado)",
  { skip },
  async () => {
    const orderId = `order-index-${Math.random().toString(36).slice(2, 8)}`
    const row = (id: string, status: "pending" | "canceled") => ({
      id,
      order_id: orderId,
      provider: "flow" as const,
      environment: "sandbox" as const,
      status,
      amount_minor: 100,
      currency: "CLP",
      description: "x",
    })
    await db.insertInto("payments").values(row("i1", "pending")).execute()
    await assert.rejects(
      () => db.insertInto("payments").values(row("i2", "pending")).execute(),
      (e: { code?: string }) => e.code === "23505"
    )
    await db.insertInto("payments").values(row("i3", "canceled")).execute() // no ocupa la orden
  }
)

test(
  "la carrera real: otro proceso gana el insert tras nuestra lectura → reutilizamos SU enlace, sin segundo checkout",
  { skip },
  async () => {
    const p = fakeProvider()
    const input = mk("stale-read")
    await db
      .insertInto("payments")
      .values({
        id: "winner",
        order_id: input.orderId,
        provider: "mercadopago",
        environment: "sandbox",
        amount_minor: input.amountMinor,
        currency: input.currency,
        description: input.description,
        checkout_url: "https://checkout.test/winner",
      })
      .execute()

    blindNextPaymentsRead = true // nuestra primera lectura no ve al ganador
    const r = await startCheckout(db, input, depsFor(p))

    assert.equal(r.paymentId, "winner")
    assert.equal(r.reused, true)
    assert.equal(
      p.calls.checkout,
      0,
      "no se creó un segundo checkout en el proveedor"
    )
    const n = await db
      .selectFrom("payments")
      .select("id")
      .where("order_id", "=", input.orderId)
      .execute()
    assert.equal(n.length, 1)
  }
)

test(
  "misma orden, mismos datos, después: reutiliza el enlace sin llamar al proveedor",
  { skip },
  async () => {
    const p = fakeProvider()
    const input = mk("reuse")
    const a = await startCheckout(db, input, depsFor(p))
    const b = await startCheckout(db, input, depsFor(p))
    assert.equal(b.reused, true)
    assert.equal(b.url, a.url)
    assert.equal(p.calls.checkout, 1)
  }
)

test(
  "orden con otro monto: error hasta que se cancela; cancelar libera la orden",
  { skip },
  async () => {
    const p = fakeProvider()
    const input = mk("changed")
    const a = await startCheckout(db, input, depsFor(p))
    await assert.rejects(
      () => startCheckout(db, { ...input, amountMinor: 20000 }, depsFor(p)),
      OrderHasActivePaymentError
    )
    assert.equal(await cancelPayment(db, a.paymentId), true)
    const b = await startCheckout(
      db,
      { ...input, amountMinor: 20000 },
      depsFor(p)
    )
    assert.notEqual(b.paymentId, a.paymentId)
  }
)

test("una orden pagada no admite otro checkout", { skip }, async () => {
  const p = fakeProvider()
  const input = mk("paid")
  const a = await startCheckout(db, input, depsFor(p))
  await applyEvent(db, approvedEv(a.paymentId))
  await assert.rejects(
    () => startCheckout(db, input, depsFor(p)),
    OrderAlreadyPaidError
  )
})

test(
  "si el proveedor falla al crear el checkout, la orden queda libre para reintentar",
  { skip },
  async () => {
    const input = mk("provider-down")
    await assert.rejects(
      () =>
        startCheckout(db, input, depsFor(fakeProvider({ failCheckout: true }))),
      ProviderApiError
    )
    const row = await db
      .selectFrom("payments")
      .select("status")
      .where("order_id", "=", input.orderId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "canceled")
    const ok = await startCheckout(db, input, depsFor(fakeProvider()))
    assert.match(ok.url, /^https:\/\/checkout\.test\//)
  }
)

test(
  "plata que llega sobre un checkout cancelado va a needs_review",
  { skip },
  async () => {
    const p = fakeProvider()
    const a = await startCheckout(db, mk("late"), depsFor(p))
    await cancelPayment(db, a.paymentId)
    const r = await applyEvent(db, approvedEv(a.paymentId))
    assert.equal(r.outcome, "needs_review")
    const row = await db
      .selectFrom("payments")
      .select("status")
      .where("id", "=", a.paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "needs_review")
  }
)

// ── syncPayment: lo que corre al volver del checkout ─────────────────────────

test(
  "syncPayment aprueba con lo que dice la API del proveedor, y repetirlo no duplica",
  { skip },
  async () => {
    const input = mk("sync")
    const created = await startCheckout(db, input, depsFor(fakeProvider()))
    const p = fakeProvider({
      state: {
        status: "approved",
        providerPaymentId: "mp-777",
        paymentId: created.paymentId,
        amountMinor: 15000,
        currency: "CLP",
      },
    })
    const first = await syncPayment(db, created.paymentId, "mp-777", depsFor(p))
    const second = await syncPayment(
      db,
      created.paymentId,
      "mp-777",
      depsFor(p)
    )
    assert.equal(first.status, "approved")
    assert.equal(second.status, "approved")
    assert.equal(first.providerPaymentId, "mp-777")
    assert.equal((await events(created.paymentId)).length, 1)
  }
)

test(
  "syncPayment rechaza una referencia que pertenece a OTRO pago (el id viene del navegador)",
  { skip },
  async () => {
    const a = await startCheckout(db, mk("sync-a"), depsFor(fakeProvider()))
    const b = await startCheckout(db, mk("sync-b"), depsFor(fakeProvider()))
    const p = fakeProvider({
      state: {
        status: "approved",
        providerPaymentId: "mp-b",
        paymentId: b.paymentId,
        amountMinor: 15000,
        currency: "CLP",
      },
    })
    await assert.rejects(
      () => syncPayment(db, a.paymentId, "mp-b", depsFor(p)),
      /no corresponde/
    )
    const row = await db
      .selectFrom("payments")
      .select("status")
      .where("id", "=", a.paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "pending")
  }
)

// ── refundPayment ────────────────────────────────────────────────────────────

test(
  "refundPayment valida el monto y no cambia el estado por sí solo",
  { skip },
  async () => {
    const p = fakeProvider()
    const a = await startCheckout(db, mk("refund"), depsFor(p))
    await assert.rejects(
      () => refundPayment(db, a.paymentId, undefined, depsFor(p)),
      /aprobado/
    )
    await applyEvent(db, approvedEv(a.paymentId))
    await assert.rejects(
      () => refundPayment(db, a.paymentId, 99999, depsFor(p)),
      /inválido/
    )
    await refundPayment(db, a.paymentId, 5000, depsFor(p))
    assert.deepEqual(p.calls.refunds, [5000])
    const row = await db
      .selectFrom("payments")
      .select(["status", "refunded_minor"])
      .where("id", "=", a.paymentId)
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "approved")
    assert.equal(
      Number(row.refunded_minor),
      0,
      "el estado lo cambia el evento confirmado, no la petición"
    )
  }
)

// ── suscripciones ────────────────────────────────────────────────────────────

test(
  "suscripciones: se crea con subscriberRef, canceled es terminal, y es idempotente",
  { skip },
  async () => {
    const sub = (
      type: "subscription.active" | "subscription.canceled",
      id: string,
      ref?: string
    ): PaymentEvent => ({
      kind: "subscription",
      type,
      provider: "paddle",
      eventId: id,
      externalId: "sub-1",
      subscriberRef: ref,
      planRef: "plan-pro",
    })
    assert.equal(
      (await applyEvent(db, sub("subscription.active", "s0"))).outcome,
      "unknown_subscription"
    )
    assert.equal(
      (await applyEvent(db, sub("subscription.active", "s1", "user-9")))
        .outcome,
      "applied"
    )
    assert.equal(
      (await applyEvent(db, sub("subscription.active", "s1", "user-9")))
        .outcome,
      "duplicate"
    )
    assert.equal(
      (await applyEvent(db, sub("subscription.canceled", "s2"))).outcome,
      "applied"
    )
    assert.equal(
      (await applyEvent(db, sub("subscription.active", "s3"))).outcome,
      "noop"
    )
    const row = await db
      .selectFrom("payments_subscriptions")
      .selectAll()
      .where("external_id", "=", "sub-1")
      .executeTakeFirstOrThrow()
    assert.equal(row.status, "canceled")
    assert.equal(row.subscriber_ref, "user-9")
  }
)

// ── 0.2: doble reembolso (candado en la base) ────────────────────────────────

async function approvedPayment(n: string, p: PaymentProvider) {
  const a = await startCheckout(db, mk(n), depsFor(p))
  await applyEvent(db, approvedEv(a.paymentId, { eventId: `evt-${n}-${a.paymentId}` }))
  return a.paymentId
}
const refundRequests = (paymentId: string) =>
  db
    .selectFrom("payments_refund_requests")
    .selectAll()
    .where("payment_id", "=", paymentId)
    .orderBy("created_at")
    .execute()

test(
  "PAY-7: dos refundPayment CONCURRENTES por el mismo monto pendiente → uno sale, el otro RefundInProgressError",
  { skip },
  async () => {
    // El proveedor tarda: los dos pedidos se cruzan antes de que conteste.
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const p = fakeProvider()
    const slow: PaymentProvider = {
      ...p,
      refund: async (id, amount, opts) => {
        await gate
        return p.refund!(id, amount, opts)
      },
    }
    const paymentId = await approvedPayment("double-refund", slow)
    const both = Promise.allSettled([
      refundPayment(db, paymentId, 10000, depsFor(slow)),
      refundPayment(db, paymentId, 10000, depsFor(slow)),
    ])
    setTimeout(release, 50)
    const settled = await both
    assert.equal(settled.filter((s) => s.status === "fulfilled").length, 1)
    const rejected = settled.find((s) => s.status === "rejected")
    assert.ok(
      rejected?.status === "rejected" &&
        rejected.reason instanceof RefundInProgressError
    )
    assert.deepEqual(p.calls.refunds, [10000], "UNA sola llamada al proveedor")
    const reqs = await refundRequests(paymentId)
    assert.equal(reqs.length, 1)
    assert.equal(reqs[0]!.status, "sent")

    // Lo que queda libre (5000) sí se puede pedir; el total no, mientras haya uno abierto.
    await assert.rejects(
      () => refundPayment(db, paymentId, undefined, depsFor(p)),
      RefundInProgressError
    )
    await refundPayment(db, paymentId, 5000, depsFor(p))

    // El proveedor confirma 15000: los pedidos quedan cerrados y el pago refunded.
    await applyEvent(db, {
      kind: "payment",
      type: "payment.refunded",
      provider: "mercadopago",
      eventId: `ref-all-${paymentId}`,
      paymentId,
      providerPaymentId: "mp-100",
      refundedMinor: 15000,
    })
    await assert.rejects(
      () => refundPayment(db, paymentId, 1, depsFor(p)),
      /aprobado/
    )
  }
)

test(
  "PAY-7: la confirmación libera la reserva; un 4xx la libera; un timeout la deja tomada",
  { skip },
  async () => {
    const p = fakeProvider()
    const paymentId = await approvedPayment("refund-release", p)
    await refundPayment(db, paymentId, 5000, depsFor(p))
    await assert.rejects(
      () => refundPayment(db, paymentId, 10001, depsFor(p)),
      RefundInProgressError
    )
    // confirmado 5000 → lo libre vuelve a ser 10000
    await applyEvent(db, {
      kind: "payment",
      type: "payment.refunded",
      provider: "mercadopago",
      eventId: `ref-5k-${paymentId}`,
      paymentId,
      providerPaymentId: "mp-100",
      refundedMinor: 5000,
    })

    const rejecting: PaymentProvider = {
      ...p,
      refund: async () => {
        throw new ProviderApiError("mercadopago", 400, "refund")
      },
    }
    await assert.rejects(
      () => refundPayment(db, paymentId, 10000, depsFor(rejecting)),
      ProviderApiError
    )
    const timingOut: PaymentProvider = {
      ...p,
      refund: async () => {
        throw new ProviderApiError("mercadopago", 0, "refund")
      },
    }
    await assert.rejects(
      () => refundPayment(db, paymentId, 4000, depsFor(timingOut)),
      ProviderApiError
    )
    const statuses = (await refundRequests(paymentId)).map((r) => r.status)
    assert.deepEqual(statuses, ["sent", "failed", "unknown"])
    // 10000 libres menos 4000 inciertos = 6000
    await assert.rejects(
      () => refundPayment(db, paymentId, 6001, depsFor(p)),
      (e: unknown) => e instanceof RefundInProgressError && e.availableMinor === 6000
    )
    await refundPayment(db, paymentId, 6000, depsFor(p))
  }
)

test(
  "OperationNotSupportedError: un proveedor sin refund no reserva nada",
  { skip },
  async () => {
    const p = fakeProvider()
    const paymentId = await approvedPayment("no-refund", p)
    const { refund: _r, ...noRefund } = p
    await assert.rejects(
      () => refundPayment(db, paymentId, 100, depsFor(noRefund)),
      OperationNotSupportedError
    )
    assert.equal((await refundRequests(paymentId)).length, 0)
  }
)

// ── 0.2: suscripción vigente, cancelar y cambiar de plan ─────────────────────

type SubFake = PaymentProvider & {
  subCalls: { cancel: [string, boolean | undefined][]; change: [string, string][] }
}
function subProvider(): SubFake {
  const subCalls = { cancel: [] as [string, boolean | undefined][], change: [] as [string, string][] }
  return {
    ...fakeProvider(),
    id: "paddle",
    subCalls,
    createSubscription: async (input) => ({
      id: `txn-${input.subscriberRef}-${Math.random().toString(36).slice(2, 6)}`,
      url: "https://pay.test/sub",
    }),
    cancelSubscription: async (id, opts) =>
      void subCalls.cancel.push([id, opts?.atPeriodEnd]),
    changeSubscriptionPlan: async (id, plan) => {
      subCalls.change.push([id, plan])
      return { mode: "in_place", billing: "prorated_immediately" }
    },
  }
}
const subEv = (
  type: "subscription.active" | "subscription.canceled",
  externalId: string,
  over: Partial<Extract<PaymentEvent, { kind: "subscription" }>> = {}
): PaymentEvent => ({
  kind: "subscription",
  type,
  provider: "paddle",
  eventId: `${type}-${externalId}-${Math.random().toString(36).slice(2, 8)}`,
  externalId,
  ...over,
})

test(
  "getActiveSubscription: un checkout nuevo sin pagar NO tapa a la activa (getSubscription sí, y no cambió)",
  { skip },
  async () => {
    const who = `user-${Math.random().toString(36).slice(2, 8)}`
    const p = subProvider()
    await applyEvent(db, subEv("subscription.active", `sub-${who}`, { subscriberRef: who, planRef: "pri_basic" }))
    await new Promise((r) => setTimeout(r, 5))
    await startSubscription(
      db,
      { subscriberRef: who, planRef: "pri_pro", returnPath: "/billing" },
      depsFor(p)
    )
    const latest = await getSubscription(db, who)
    assert.equal(latest?.status, "pending", "comportamiento viejo intacto")
    const active = await getActiveSubscription(db, who)
    assert.equal(active?.status, "active")
    assert.equal(active?.planRef, "pri_basic")
    const all = await listSubscriptions(db, who)
    assert.deepEqual(all.map((s) => s.status), ["pending", "active"])
  }
)

test(
  "cancelSubscription y changeSubscriptionPlan solo PIDEN: el estado local cambia con el webhook",
  { skip },
  async () => {
    const who = `user-${Math.random().toString(36).slice(2, 8)}`
    const ext = `sub-${who}`
    const p = subProvider()
    await applyEvent(db, subEv("subscription.active", ext, { subscriberRef: who, planRef: "pri_basic" }))

    await assert.rejects(
      () => changeSubscriptionPlan(db, who, "pri_basic", depsFor(p)),
      (e: unknown) => e instanceof SubscriptionChangeError && e.code === "same_plan"
    )
    const change = await changeSubscriptionPlan(db, who, "pri_pro", depsFor(p))
    assert.equal(change.mode, "in_place")
    assert.deepEqual(p.subCalls.change, [[ext, "pri_pro"]])
    assert.equal((await getActiveSubscription(db, who))?.planRef, "pri_basic", "sin webhook, nada cambia")
    await applyEvent(db, subEv("subscription.active", ext, { planRef: "pri_pro", occurredAt: new Date() }))
    assert.equal((await getActiveSubscription(db, who))?.planRef, "pri_pro")

    const res = await cancelSubscription(db, { subscriberRef: who }, { atPeriodEnd: true }, depsFor(p))
    assert.equal(res.externalId, ext)
    assert.deepEqual(p.subCalls.cancel, [[ext, true]])
    const before = await getActiveSubscription(db, who)
    assert.equal(before?.status, "active")
    assert.equal(before?.cancelAt, null)
    const end = new Date(Date.now() + 86_400_000)
    await applyEvent(db, subEv("subscription.active", ext, { cancelAt: end, occurredAt: new Date() }))
    assert.equal((await getActiveSubscription(db, who))?.cancelAt?.getTime(), end.getTime())

    await applyEvent(db, subEv("subscription.canceled", ext, { currentPeriodEnd: new Date(Date.now() - 1000) }))
    assert.equal(await getActiveSubscription(db, who), null)
    await assert.rejects(
      () => cancelSubscription(db, { subscriberRef: who }, { atPeriodEnd: false }, depsFor(p)),
      (e: unknown) => e instanceof SubscriptionChangeError && e.code === "not_found"
    )
  }
)

test(
  "cancelar / cambiar con un proveedor que no lo implementa → OperationNotSupportedError, sin éxito fingido",
  { skip },
  async () => {
    const who = `user-${Math.random().toString(36).slice(2, 8)}`
    await applyEvent(db, subEv("subscription.active", `sub-${who}`, { subscriberRef: who, planRef: "pri_basic" }))
    const bare = fakeProvider() // sin cancelSubscription ni changeSubscriptionPlan
    await assert.rejects(
      () => cancelSubscription(db, { subscriberRef: who }, { atPeriodEnd: true }, depsFor(bare)),
      OperationNotSupportedError
    )
    await assert.rejects(
      () => changeSubscriptionPlan(db, who, "pri_pro", depsFor(bare)),
      OperationNotSupportedError
    )
    await assert.rejects(
      () => cancelSubscription(db, { subscriptionId: "no-existe" }, { atPeriodEnd: true }, depsFor(bare)),
      (e: unknown) => e instanceof SubscriptionChangeError && e.code === "not_found"
    )
  }
)
