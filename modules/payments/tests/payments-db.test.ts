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
import {
  OrderAlreadyPaidError,
  OrderHasActivePaymentError,
  ProviderApiError,
  type PaymentEvent,
  type PaymentProvider,
} from "../contracts/types"
import { applyEvent, applyEvents } from "../server/apply"
import {
  cancelPayment,
  getPaymentByOrder,
  refundPayment,
  startCheckout,
  syncPayment,
  type CheckoutDeps,
} from "../server/checkout"

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
