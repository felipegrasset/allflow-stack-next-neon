/**
 * Adaptador de Paddle: sin red (fetch simulado). La firma se calcula aquí con
 * un secreto de prueba; ninguna llave real. Los casos de base de datos corren
 * solo con DATABASE_URL (schema propio, se borra al terminar).
 */
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { up } from "../db/migrations/0101_payments_init"
import {
  ProviderApiError,
  WebhookAuthError,
  type PaymentEvent,
  type PaymentProvider,
} from "../contracts/types"
import { createProvider } from "../providers/paddle"
import { startCheckout, type CheckoutDeps } from "../server/checkout"
import { handleWebhook } from "../server/webhook"

const API_KEY = "test-api-key"
const SECRET = "test-webhook-secret"
const NOW_MS = 1_800_000_000_000
const NOW_S = NOW_MS / 1000
const ENV = {
  PADDLE_API_KEY: API_KEY,
  PADDLE_WEBHOOK_SECRET: SECRET,
  PAYMENTS_ENV: "sandbox",
  BETTER_AUTH_URL: "https://app.test",
}
const TEXT = "Licencia de prueba"

type Call = {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}
function fakeFetch(
  responder: (c: Call) => { status?: number; json: unknown }
): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const f = (async (url: string, init: RequestInit = {}) => {
    const c: Call = {
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(c)
    const r = responder(c)
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
  return { fetch: f, calls }
}

const noNet = fakeFetch(() => {
  throw new Error("sin red en esta prueba")
})
const mkProvider = (
  f: typeof fetch = noNet.fetch,
  env: Record<string, string> = ENV
) => createProvider(env, { fetch: f, now: () => NOW_MS })!

const sign = (body: string, ts = NOW_S, secret = SECRET) =>
  `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`
const req = (header: string | null) =>
  new Request("https://app.test/api/payments/webhook/paddle", {
    method: "POST",
    headers: header ? { "Paddle-Signature": header } : {},
  })
const send = (p: PaymentProvider, body: string, header: string | null) =>
  p.parseWebhook(req(header), body)
const signed = (p: PaymentProvider, payload: unknown) => {
  const body = JSON.stringify(payload)
  return send(p, body, sign(body))
}

const txnCompleted = (over: Record<string, unknown> = {}, id = "evt_1") => ({
  event_id: id,
  event_type: "transaction.completed",
  data: {
    id: "txn_1",
    status: "completed",
    currency_code: "USD",
    custom_data: { payment_id: "pay-app-1" },
    details: { totals: { grand_total: "1500" } },
    ...over,
  },
})

// ── firma ────────────────────────────────────────────────────────────────────

test("firma válida: acepta y devuelve el evento", async () => {
  const ev = await signed(mkProvider(), txnCompleted())
  assert.equal(ev.length, 1)
  assert.equal(ev[0]!.type, "payment.approved")
})

test("firma válida: acepta cuando hay varios h1 (rotación de secreto)", async () => {
  const body = JSON.stringify(txnCompleted())
  const good = sign(body).split(";h1=")[1]
  const header = `ts=${NOW_S};h1=${"0".repeat(64)};h1=${good}`
  assert.equal((await send(mkProvider(), body, header)).length, 1)
})

const rejects = (p: Promise<unknown>) =>
  assert.rejects(p, (e) => e instanceof WebhookAuthError)

test("sin header, firma mala, ts alterado, cuerpo alterado, secreto equivocado: WebhookAuthError", async () => {
  const p = mkProvider()
  const body = JSON.stringify(txnCompleted())
  await rejects(send(p, body, null))
  await rejects(send(p, body, `ts=${NOW_S};h1=${"a".repeat(64)}`))
  await rejects(send(p, body, "basura"))
  await rejects(send(p, body, `ts=${NOW_S}`)) // sin h1
  await rejects(send(p, body, `h1=${"a".repeat(64)}`)) // sin ts
  // ts cambiado después de firmar
  const h1 = sign(body).split(";h1=")[1]
  await rejects(send(p, body, `ts=${NOW_S + 1};h1=${h1}`))
  // cuerpo cambiado después de firmar
  const tampered = body.replace('"1500"', '"1"')
  assert.notEqual(tampered, body)
  await rejects(send(p, tampered, sign(body)))
  // firmado con otro secreto
  await rejects(send(p, body, sign(body, NOW_S, "otro-secreto")))
})

test("timestamp viejo (replay) y futuro lejano: WebhookAuthError aunque la firma sea válida", async () => {
  const p = mkProvider()
  const body = JSON.stringify(txnCompleted())
  await rejects(send(p, body, sign(body, NOW_S - 301)))
  await rejects(send(p, body, sign(body, NOW_S + 301)))
  assert.equal((await send(p, body, sign(body, NOW_S - 299))).length, 1)
})

test("sin secreto no hay proveedor usable: falta solo una variable lanza; ninguna → null", () => {
  assert.equal(createProvider({}), null)
  assert.throws(
    () => createProvider({ PADDLE_API_KEY: API_KEY }),
    /PADDLE_WEBHOOK_SECRET/
  )
  assert.throws(
    () => createProvider({ PADDLE_WEBHOOK_SECRET: SECRET }),
    /PADDLE_API_KEY/
  )
})

test("un cuerpo no autenticado nunca llega a llamar a la API (la autenticación va primero)", async () => {
  const f = fakeFetch(() => ({ json: { data: [] } }))
  const p = mkProvider(f.fetch)
  const body = JSON.stringify({
    event_id: "evt_x",
    event_type: "adjustment.updated",
    data: {
      action: "refund",
      status: "approved",
      transaction_id: "txn_1",
      totals: { total: "100" },
    },
  })
  await rejects(send(p, body, `ts=${NOW_S};h1=${"b".repeat(64)}`))
  assert.equal(f.calls.length, 0)
})

// ── mapeos ───────────────────────────────────────────────────────────────────

test("transaction.completed → payment.approved con paymentId de custom_data y monto USD en centavos", async () => {
  const [e] = (await signed(mkProvider(), txnCompleted())) as PaymentEvent[]
  assert.deepEqual(e, {
    provider: "paddle",
    eventId: "evt_1",
    kind: "payment",
    type: "payment.approved",
    paymentId: "pay-app-1",
    providerPaymentId: "txn_1",
    amountMinor: 1500,
    currency: "USD",
  })
})

test("JPY (sin decimales): '1500' son 1500 yenes, no 15", async () => {
  const [e] = await signed(
    mkProvider(),
    txnCompleted({
      currency_code: "JPY",
      details: { totals: { grand_total: "1500" } },
    })
  )
  assert.equal(
    e!.kind === "payment" && "amountMinor" in e && e.amountMinor,
    1500
  )
})

test("sin custom_data.payment_id el evento no inventa paymentId", async () => {
  const [e] = await signed(mkProvider(), txnCompleted({ custom_data: null }))
  assert.equal(e!.kind === "payment" && e.paymentId, undefined)
})

test("monto malformado (decimal, negativo, texto) no pasa", async () => {
  for (const bad of ["15.00", "-5", "abc", "", null]) {
    await assert.rejects(
      signed(
        mkProvider(),
        txnCompleted({ details: { totals: { grand_total: bad } } })
      )
    )
  }
})

test("payment_failed → failed; past_due y billed → pending; otros eventos → []", async () => {
  const p = mkProvider()
  const t = (event_type: string) =>
    signed(p, {
      event_id: "e",
      event_type,
      data: { id: "txn_9", custom_data: { payment_id: "x" } },
    })
  assert.equal(
    (await t("transaction.payment_failed"))[0]!.type,
    "payment.failed"
  )
  assert.equal((await t("transaction.past_due"))[0]!.type, "payment.pending")
  assert.equal((await t("transaction.billed"))[0]!.type, "payment.pending")
  assert.deepEqual(await t("transaction.updated"), [])
  assert.deepEqual(await t("customer.created"), [])
  assert.deepEqual(await send(p, "no es json", sign("no es json")), [])
})

const adj = (over: Record<string, unknown> = {}) => ({
  event_id: "evt_adj",
  event_type: "adjustment.updated",
  data: {
    id: "adj_2",
    action: "refund",
    status: "approved",
    transaction_id: "txn_1",
    currency_code: "USD",
    totals: { total: "500" },
    ...over,
  },
})

test("reembolso aprobado: el acumulado sale de la API (suma de ajustes aprobados), no del evento", async () => {
  const f = fakeFetch(() => ({
    json: {
      data: [{ totals: { total: "700" } }, { totals: { total: "500" } }],
      meta: {
        pagination: { has_more: false, next: "https://x.test/?after=a" },
      },
    },
  }))
  const [e] = await signed(mkProvider(f.fetch), adj())
  assert.equal(
    e!.kind === "payment" && e.type === "payment.refunded" && e.refundedMinor,
    1200
  )
  assert.match(
    f.calls[0]!.url,
    /^https:\/\/sandbox-api\.paddle\.com\/adjustments\?transaction_id=txn_1&action=refund&status=approved/
  )
  assert.equal(f.calls[0]!.headers.Authorization, `Bearer ${API_KEY}`)
})

test("reembolso: pagina la lista de ajustes", async () => {
  let n = 0
  const f = fakeFetch((c) => {
    n++
    return n === 1
      ? {
          json: {
            data: [{ totals: { total: "300" } }],
            meta: {
              pagination: {
                has_more: true,
                next: "https://x.test/adjustments?after=adj_a",
              },
            },
          },
        }
      : (assert.match(c.url, /after=adj_a/),
        {
          json: {
            data: [{ totals: { total: "200" } }],
            meta: { pagination: { has_more: false } },
          },
        })
  })
  const [e] = await signed(
    mkProvider(f.fetch),
    adj({ totals: { total: "200" } })
  )
  assert.equal(
    e!.kind === "payment" && e.type === "payment.refunded" && e.refundedMinor,
    500
  )
})

test("reembolso: si la lista aún no incluye el ajuste del evento, no se pierde (mínimo = el propio)", async () => {
  const f = fakeFetch(() => ({
    json: { data: [], meta: { pagination: { has_more: false } } },
  }))
  const [e] = await signed(mkProvider(f.fetch), adj())
  assert.equal(
    e!.kind === "payment" && e.type === "payment.refunded" && e.refundedMinor,
    500
  )
})

test("ajuste pendiente de aprobación, rechazado, de crédito o chargeback → [] y sin llamar a la API", async () => {
  const f = fakeFetch(() => ({ json: {} }))
  const p = mkProvider(f.fetch)
  assert.deepEqual(await signed(p, adj({ status: "pending_approval" })), [])
  assert.deepEqual(await signed(p, adj({ status: "rejected" })), [])
  assert.deepEqual(await signed(p, adj({ action: "credit" })), [])
  assert.deepEqual(await signed(p, adj({ action: "chargeback" })), [])
  assert.equal(f.calls.length, 0)
})

const sub = (event_type: string, over: Record<string, unknown> = {}) => ({
  event_id: `evt_${event_type}`,
  event_type,
  data: {
    id: "sub_1",
    custom_data: { subscriber_ref: "user-7" },
    items: [{ price: { id: "pri_1" } }],
    current_billing_period: { ends_at: "2027-01-15T00:00:00Z" },
    ...over,
  },
})

test("suscripciones: created/activated → active; past_due; canceled; con subscriberRef, planRef y fin de período", async () => {
  const p = mkProvider()
  for (const [t, want] of [
    ["subscription.created", "subscription.active"],
    ["subscription.activated", "subscription.active"],
    ["subscription.past_due", "subscription.past_due"],
    ["subscription.canceled", "subscription.canceled"],
  ] as const) {
    const [e] = await signed(p, sub(t))
    assert.equal(e!.type, want)
    assert.ok(e!.kind === "subscription")
    assert.equal(e.externalId, "sub_1")
    assert.equal(e.subscriberRef, "user-7")
    assert.equal(e.planRef, "pri_1")
    assert.equal(e.currentPeriodEnd?.toISOString(), "2027-01-15T00:00:00.000Z")
  }
  assert.deepEqual(await signed(p, sub("subscription.updated")), [])
})

// ── llamadas a la API ────────────────────────────────────────────────────────

const input = {
  paymentId: "pay-app-9",
  orderId: "order-9",
  amountMinor: 1500,
  currency: "usd",
  description: TEXT,
  successUrl: "https://app.test/ok",
  failureUrl: "https://app.test/ko",
  pendingUrl: "https://app.test/p",
  notificationUrl: "https://app.test/api/payments/webhook/paddle",
  environment: "sandbox" as const,
}

test("createCheckout: POST /transactions con ítem no-catálogo, monto string en unidad menor y custom_data.payment_id", async () => {
  const f = fakeFetch(() => ({
    json: {
      data: {
        id: "txn_77",
        checkout: { url: "https://pay.test/?_ptxn=txn_77" },
      },
    },
  }))
  const out = await mkProvider(f.fetch).createCheckout(input)
  assert.deepEqual(out, { id: "txn_77", url: "https://pay.test/?_ptxn=txn_77" })
  const c = f.calls[0]!
  assert.equal(c.url, "https://sandbox-api.paddle.com/transactions")
  assert.equal(c.method, "POST")
  const b = c.body as {
    custom_data: Record<string, string>
    items: {
      price: {
        unit_price: { amount: string; currency_code: string }
        product: { tax_category: string }
      }
    }[]
  }
  assert.equal(b.custom_data.payment_id, "pay-app-9")
  assert.deepEqual(b.items[0]!.price.unit_price, {
    amount: "1500",
    currency_code: "USD",
  })
})

test("producción usa api.paddle.com; sandbox usa sandbox-api", async () => {
  const f = fakeFetch(() => ({
    json: { data: { id: "t", checkout: { url: "https://p.test" } } },
  }))
  await mkProvider(f.fetch, {
    ...ENV,
    PAYMENTS_ENV: "production",
  }).createCheckout(input)
  assert.match(f.calls[0]!.url, /^https:\/\/api\.paddle\.com\//)
})

test("createCheckout sin checkout.url falla (no devuelve una URL inventada)", async () => {
  const f = fakeFetch(() => ({
    json: { data: { id: "txn_1", checkout: null } },
  }))
  await assert.rejects(
    mkProvider(f.fetch).createCheckout(input),
    /checkout\.url/
  )
})

test("error de API: solo estado; ni el cuerpo de la respuesta ni la llave aparecen en el error", async () => {
  const SECRET_BODY = "email-de-cliente@ejemplo.test detalle-privado"
  const f = fakeFetch(() => ({
    status: 403,
    json: { error: { detail: SECRET_BODY } },
  }))
  const p = mkProvider(f.fetch)
  await assert.rejects(p.createCheckout(input), (e) => {
    assert.ok(e instanceof ProviderApiError)
    assert.equal(e.status, 403)
    const dump = `${e.message} ${JSON.stringify(e)} ${e.stack}`
    assert.ok(!dump.includes(SECRET_BODY) && !dump.includes("detalle-privado"))
    assert.ok(!dump.includes(API_KEY))
    return true
  })
  // y un fallo de red tampoco arrastra la URL ni la llave
  const boom = mkProvider((async () => {
    throw new Error(`fallo con ${API_KEY}`)
  }) as unknown as typeof fetch)
  await assert.rejects(boom.getPayment("txn_1"), (e) => {
    assert.ok(e instanceof ProviderApiError)
    assert.ok(!`${e.message} ${e.stack}`.includes(API_KEY))
    return true
  })
})

test("getPayment: completed sin reembolsos → approved; con reembolso total → refunded; canceled → failed; otros → pending", async () => {
  const txn = (status: string) => ({
    data: {
      id: "txn_1",
      status,
      currency_code: "USD",
      custom_data: { payment_id: "pay-app-1" },
      details: { totals: { grand_total: "1500" } },
    },
  })
  const mk = (status: string, refunds: string[]) =>
    mkProvider(
      fakeFetch((c) =>
        c.url.includes("/adjustments")
          ? {
              json: {
                data: refunds.map((t) => ({ totals: { total: t } })),
                meta: { pagination: { has_more: false } },
              },
            }
          : { json: txn(status) }
      ).fetch
    )
  const a = await mk("completed", []).getPayment("txn_1")
  assert.deepEqual(
    [a.status, a.amountMinor, a.currency, a.paymentId, a.refundedMinor],
    ["approved", 1500, "USD", "pay-app-1", 0]
  )
  assert.equal(
    (await mk("completed", ["1500"]).getPayment("txn_1")).status,
    "refunded"
  )
  const part = await mk("completed", ["500"]).getPayment("txn_1")
  assert.deepEqual([part.status, part.refundedMinor], ["approved", 500])
  assert.equal((await mk("canceled", []).getPayment("txn_1")).status, "failed")
  assert.equal((await mk("billed", []).getPayment("txn_1")).status, "pending")
  assert.equal((await mk("paid", []).getPayment("txn_1")).status, "pending")
})

test("refund: total y parcial vía POST /adjustments; no completada → no llama a /adjustments", async () => {
  const mk = (status: string, items = [{ id: "txnitm_1" }]) =>
    fakeFetch((c) =>
      c.method === "GET"
        ? { json: { data: { status, items } } }
        : { json: { data: { id: "adj_1" } } }
    )
  const full = mk("completed")
  await mkProvider(full.fetch).refund!("txn_1")
  const fb = full.calls[1]!.body as Record<string, unknown>
  assert.equal(full.calls[1]!.url, "https://sandbox-api.paddle.com/adjustments")
  assert.deepEqual(
    [fb.action, fb.type, fb.transaction_id],
    ["refund", "full", "txn_1"]
  )

  const part = mk("completed")
  await mkProvider(part.fetch).refund!("txn_1", 500)
  assert.deepEqual(part.calls[1]!.body, {
    action: "refund",
    type: "partial",
    transaction_id: "txn_1",
    reason: "requested_by_customer",
    items: [{ item_id: "txnitm_1", type: "partial", amount: "500" }],
  })

  const billed = mk("billed")
  await assert.rejects(mkProvider(billed.fetch).refund!("txn_1"), /completed/)
  assert.equal(billed.calls.length, 1)
  await assert.rejects(
    mkProvider(mk("completed").fetch).refund!("txn_1", 1.5),
    /inválido/
  )
  await assert.rejects(
    mkProvider(mk("completed", [{ id: "a" }, { id: "b" }]).fetch).refund!(
      "txn_1",
      100
    ),
    /un ítem/
  )
})

test("createSubscription: transacción con el price id y subscriber_ref; cancelSubscription: POST /subscriptions/{id}/cancel", async () => {
  const f = fakeFetch(() => ({
    json: { data: { id: "txn_s", checkout: { url: "https://pay.test/s" } } },
  }))
  const p = mkProvider(f.fetch)
  const out = await p.createSubscription!({
    subscriberRef: "user-7",
    planRef: "pri_1",
    returnPath: "/x",
    notificationUrl: "https://app.test/n",
    successUrl: "https://app.test/s",
  })
  assert.deepEqual(out, { id: "txn_s", url: "https://pay.test/s" })
  assert.deepEqual(f.calls[0]!.body, {
    items: [{ price_id: "pri_1", quantity: 1 }],
    custom_data: { subscriber_ref: "user-7" },
  })
  await p.cancelSubscription!("sub_9")
  assert.equal(
    f.calls[1]!.url,
    "https://sandbox-api.paddle.com/subscriptions/sub_9/cancel"
  )
  assert.equal(f.calls[1]!.method, "POST")
})

// ── punta a punta contra Postgres: webhook firmado → handleWebhook → fila ────

const dbUrl = process.env.DATABASE_URL
const skip = dbUrl
  ? false
  : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `paddle_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: dbUrl, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: dbUrl, max: 8 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await up(db as unknown as Kysely<unknown>)
})
after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

async function newPayment(): Promise<string> {
  const f = fakeFetch(() => ({
    json: {
      data: { id: "txn_e2e", checkout: { url: "https://pay.test/e2e" } },
    },
  }))
  const p = mkProvider(f.fetch)
  const deps: CheckoutDeps = {
    env: ENV,
    resolveProvider: async () => p,
    getProvider: async () => p,
  }
  const { paymentId } = await startCheckout(
    db,
    {
      orderId: `order-${Math.random().toString(36).slice(2, 8)}`,
      amountMinor: 1500,
      currency: "USD",
      description: TEXT,
      returnPath: "/orders/1",
      provider: "paddle",
    },
    deps
  )
  // el payment_id que se mandó a Paddle es el de la fila
  assert.equal(
    (f.calls[0]!.body as { custom_data: { payment_id: string } }).custom_data
      .payment_id,
    paymentId
  )
  return paymentId
}
const status = (id: string) =>
  db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow()
const webhook = (body: string, header: string | null) =>
  handleWebhook(
    async () => mkProvider(),
    new Request("https://app.test/api/payments/webhook/paddle", {
      method: "POST",
      body,
      headers: header ? { "Paddle-Signature": header } : {},
    }),
    db
  )

test(
  "e2e: webhook firmado → fila approved; el mismo evento x5 deja un solo cambio",
  { skip },
  async () => {
    const paymentId = await newPayment()
    const body = JSON.stringify(
      txnCompleted({ custom_data: { payment_id: paymentId } }, "evt_e2e_1")
    )
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => webhook(body, sign(body)))
    )
    const results = (await Promise.all(rs.map((r) => r.json()))).map(
      (j) => j.results[0].outcome
    )
    assert.equal(results.filter((o) => o === "applied").length, 1)
    assert.equal(results.filter((o) => o === "duplicate").length, 4)
    const row = await status(paymentId)
    assert.equal(row.status, "approved")
    assert.equal(row.provider_payment_id, "txn_1")
    const evs = await db
      .selectFrom("payments_events")
      .selectAll()
      .where("payment_id", "=", paymentId)
      .execute()
    assert.equal(evs.length, 1)
  }
)

test(
  "e2e: webhook sin firma o con firma falsa → 401 y NADA escrito",
  { skip },
  async () => {
    const paymentId = await newPayment()
    const body = JSON.stringify(
      txnCompleted({ custom_data: { payment_id: paymentId } }, "evt_e2e_bad")
    )
    assert.equal((await webhook(body, null)).status, 401)
    assert.equal(
      (await webhook(body, `ts=${NOW_S};h1=${"c".repeat(64)}`)).status,
      401
    )
    assert.equal((await webhook(body, sign(body, NOW_S - 1000))).status, 401)
    assert.equal((await status(paymentId)).status, "pending")
    const evs = await db
      .selectFrom("payments_events")
      .selectAll()
      .where("event_id", "=", "evt_e2e_bad")
      .execute()
    assert.equal(evs.length, 0)
  }
)

test(
  "e2e: monto distinto en un webhook firmado → needs_review (PAY-5)",
  { skip },
  async () => {
    const paymentId = await newPayment()
    const body = JSON.stringify(
      txnCompleted(
        {
          custom_data: { payment_id: paymentId },
          details: { totals: { grand_total: "100" } },
        },
        "evt_e2e_mm"
      )
    )
    assert.equal((await webhook(body, sign(body))).status, 200)
    assert.equal((await status(paymentId)).status, "needs_review")
  }
)

test(
  "e2e: evento de suscripción crea la fila con subscriber_ref (y x5 no duplica)",
  { skip },
  async () => {
    const body = JSON.stringify(
      sub("subscription.activated", { id: "sub_e2e" })
    )
    for (let i = 0; i < 5; i++)
      assert.equal((await webhook(body, sign(body))).status, 200)
    const rows = await db
      .selectFrom("payments_subscriptions")
      .selectAll()
      .where("external_id", "=", "sub_e2e")
      .execute()
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.subscriber_ref, "user-7")
    assert.equal(rows[0]!.plan_ref, "pri_1")
    assert.equal(rows[0]!.status, "active")
    assert.ok(rows[0]!.current_period_end)
  }
)
