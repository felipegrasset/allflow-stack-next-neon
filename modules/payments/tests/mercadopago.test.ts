/**
 * Adaptador de Mercado Pago: firma, no confiar en el cuerpo, mapeo de estados y
 * montos, reembolso, errores sin filtrar, y punta a punta contra Postgres.
 * Sin red: `fetch` se inyecta. Ninguna llave real: marcadores de prueba.
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
  ProviderNotConfiguredError,
  WebhookAuthError,
  type PaymentProvider,
} from "../contracts/types"
import {
  createMercadoPagoProvider,
  createProvider,
} from "../providers/mercadopago"
import { startCheckout, syncPayment } from "../server/checkout"
import { handleWebhook } from "../server/webhook"

const SAMPLE_TEXT = "Pedido de prueba"
const TOKEN = "test-token"
const SECRET = "test-webhook-secret"
const ENV = {
  MERCADOPAGO_ACCESS_TOKEN: TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: SECRET,
  BETTER_AUTH_URL: "https://app.test",
  PAYMENTS_ENV: "sandbox",
}

// ── utilidades ───────────────────────────────────────────────────────────────

type Call = { url: string; method: string; headers: Headers; body?: string }
type Handler = (c: Call) => { status?: number; json?: unknown } | undefined

function fakeFetch(handler: Handler) {
  const calls: Call[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const c: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body as string | undefined,
    }
    calls.push(c)
    const r = handler(c) ?? { status: 404, json: {} }
    return new Response(JSON.stringify(r.json ?? {}), {
      status: r.status ?? 200,
    })
  }) as typeof fetch
  return { fetch: f, calls }
}

const sign = (
  dataId: string | null,
  requestId: string | null,
  ts = "1700000000",
  secret = SECRET
) => {
  let m = ""
  if (dataId) m += `id:${dataId.toLowerCase()};`
  if (requestId) m += `request-id:${requestId};`
  m += `ts:${ts};`
  return `ts=${ts},v1=${createHmac("sha256", secret).update(m).digest("hex")}`
}

type ReqOpts = {
  dataId?: string
  signature?: string | null
  requestId?: string | null
  type?: string
  body?: unknown
}
/** Una notificación como la manda MP: `data.id` en la query y también en el cuerpo. */
function webhookReq(o: ReqOpts = {}) {
  const dataId = o.dataId ?? "1001"
  const type = o.type ?? "payment"
  const headers = new Headers()
  if (o.signature !== null)
    headers.set(
      "x-signature",
      o.signature ?? sign(dataId, o.requestId ?? "req-1")
    )
  if (o.requestId !== null) headers.set("x-request-id", o.requestId ?? "req-1")
  const raw = JSON.stringify(o.body ?? { type, data: { id: dataId } })
  const req = new Request(
    `https://app.test/api/payments/webhook/mercadopago?data.id=${dataId}&type=${type}`,
    { method: "POST", headers, body: raw }
  )
  return { req, raw }
}

const mpPayment = (over: Record<string, unknown> = {}) => ({
  id: 1001,
  status: "approved",
  external_reference: "pay-1",
  currency_id: "CLP",
  transaction_amount: 15000,
  transaction_amount_refunded: 0,
  ...over,
})

/** Proveedor cuya API responde `payment` en GET /v1/payments/1001. */
function providerWith(payment: unknown, status = 200) {
  const f = fakeFetch((c) =>
    c.url.endsWith("/v1/payments/1001") ? { status, json: payment } : undefined
  )
  return {
    provider: createProvider(ENV, { fetch: f.fetch })!,
    calls: f.calls,
  }
}

const parse = (p: PaymentProvider, o?: ReqOpts) => {
  const { req, raw } = webhookReq(o)
  return p.parseWebhook(req, raw)
}

// ── firma ────────────────────────────────────────────────────────────────────

test("firma válida: acepta y devuelve el evento desde la API", async () => {
  const { provider } = providerWith(mpPayment())
  const evs = await parse(provider)
  assert.equal(evs.length, 1)
  assert.equal(evs[0].type, "payment.approved")
})

const rejects = (reason: string) => (e: unknown) =>
  e instanceof WebhookAuthError && e.reason === reason

test("firma inválida (otro secreto) → WebhookAuthError y NO consulta la API", async () => {
  const { provider, calls } = providerWith(mpPayment())
  await assert.rejects(
    parse(provider, { signature: sign("1001", "req-1", "1700000000", "otro") }),
    rejects("bad_signature")
  )
  assert.equal(calls.length, 0)
})

test("firma ausente → WebhookAuthError", async () => {
  const { provider, calls } = providerWith(mpPayment())
  await assert.rejects(
    parse(provider, { signature: null }),
    rejects("no_signature")
  )
  assert.equal(calls.length, 0)
})

test("firma mal formada → WebhookAuthError", async () => {
  const { provider } = providerWith(mpPayment())
  for (const signature of [
    "basura",
    "ts=1,v1=zz",
    "v1=" + "a".repeat(64),
    "ts=abc,v1=" + "a".repeat(64),
  ]) {
    await assert.rejects(
      parse(provider, { signature }),
      rejects("bad_signature_format"),
      signature
    )
  }
})

test("ts alterado → WebhookAuthError", async () => {
  const { provider } = providerWith(mpPayment())
  const good = sign("1001", "req-1", "1700000000")
  const tampered = good.replace("ts=1700000000", "ts=1700000001")
  await assert.rejects(
    parse(provider, { signature: tampered }),
    rejects("bad_signature")
  )
})

test("data.id alterado (firmado para otro pago) → WebhookAuthError", async () => {
  const { provider } = providerWith(mpPayment())
  await assert.rejects(
    parse(provider, { dataId: "1001", signature: sign("9999", "req-1") }),
    rejects("bad_signature")
  )
})

test("request-id vacío: el manifest lo OMITE; firmado con `request-id:;` se rechaza", async () => {
  const { provider } = providerWith(mpPayment())
  // bien firmado (sin la parte request-id) y cabecera x-request-id vacía → acepta
  const ok = await parse(provider, {
    requestId: "",
    signature: sign("1001", null),
  })
  assert.equal(ok.length, 1)
  // el manifest de Ystore (con `request-id:;`) NO es el de MP → rechaza
  const bad = `ts=1700000000,v1=${createHmac("sha256", SECRET).update("id:1001;request-id:;ts:1700000000;").digest("hex")}`
  await assert.rejects(
    parse(provider, { requestId: "", signature: bad }),
    rejects("bad_signature")
  )
})

test("sin secreto configurado → WebhookAuthError (rechaza, nunca acepta)", async () => {
  const f = fakeFetch(() => ({ json: mpPayment() }))
  const p = createMercadoPagoProvider(
    { accessToken: TOKEN, webhookSecret: "" },
    { fetch: f.fetch }
  )
  // incluso con una firma "válida" calculada con secreto vacío
  await assert.rejects(
    parse(p, { signature: sign("1001", "req-1", "1700000000", "") }),
    rejects("no_secret")
  )
  assert.equal(f.calls.length, 0)
  // y con las variables: falta solo el secreto → no hay proveedor (la ruta responde 401)
  assert.throws(
    () => createProvider({ MERCADOPAGO_ACCESS_TOKEN: TOKEN }),
    ProviderNotConfiguredError
  )
  assert.equal(createProvider({}), null)
})

test("data.id en mayúsculas: se firma en minúsculas y se consulta en minúsculas", async () => {
  // un id alfanumérico en mayúsculas llega firmado en minúsculas (regla de MP)
  const dataId = "ABC123"
  const f = fakeFetch(() => ({ json: {} }))
  const p = createProvider(ENV, { fetch: f.fetch })!
  const evs = await parse(p, { dataId, signature: sign("abc123", "req-1") })
  // pasó la firma; el id no es numérico, así que no se consulta nada
  assert.deepEqual(evs, [])
  assert.equal(f.calls.length, 0)
})

test("otros topics autenticados → []; no autenticados → WebhookAuthError", async () => {
  const { provider, calls } = providerWith(mpPayment())
  assert.deepEqual(await parse(provider, { type: "merchant_order" }), [])
  assert.equal(calls.length, 0)
  await assert.rejects(
    parse(provider, { type: "merchant_order", signature: sign("1", "x") }),
    WebhookAuthError
  )
})

// ── no confiar en el cuerpo ──────────────────────────────────────────────────

test("cuerpo mentiroso: dice approved pero la API dice pending → NO aprueba", async () => {
  const { provider } = providerWith(mpPayment({ status: "pending" }))
  const evs = await parse(provider, {
    body: {
      type: "payment",
      data: { id: "1001" },
      status: "approved",
      transaction_amount: 15000,
      external_reference: "pay-1",
    },
  })
  assert.deepEqual(
    evs.map((e) => e.type),
    ["payment.pending"]
  )
})

// ── mapeo de estados y montos ────────────────────────────────────────────────

test("mapeo de estados", async () => {
  const cases: [Record<string, unknown>, string[]][] = [
    [{ status: "approved" }, ["payment.approved"]],
    [{ status: "pending" }, ["payment.pending"]],
    [{ status: "in_process" }, ["payment.pending"]],
    [{ status: "rejected" }, ["payment.failed"]],
    [{ status: "cancelled" }, ["payment.failed"]],
    [{ status: "refunded" }, ["payment.approved", "payment.refunded"]],
    [{ status: "charged_back" }, ["payment.approved", "payment.refunded"]],
    [
      { status: "approved", transaction_amount_refunded: 5000 },
      ["payment.approved", "payment.refunded"],
    ],
  ]
  for (const [over, types] of cases) {
    const { provider } = providerWith(mpPayment(over))
    assert.deepEqual(
      (await parse(provider)).map((e) => e.type),
      types,
      JSON.stringify(over)
    )
  }
})

test("montos: CLP sin decimales, USD con centavos; paymentId = external_reference", async () => {
  const clp = (await parse(providerWith(mpPayment()).provider))[0]
  assert.ok(clp.kind === "payment" && clp.type === "payment.approved")
  assert.equal(clp.amountMinor, 15000)
  assert.equal(clp.currency, "CLP")
  assert.equal(clp.paymentId, "pay-1")
  assert.equal(clp.providerPaymentId, "1001")

  const usd = (
    await parse(
      providerWith(mpPayment({ currency_id: "USD", transaction_amount: 15.1 }))
        .provider
    )
  )[0]
  assert.ok(usd.kind === "payment" && usd.type === "payment.approved")
  assert.equal(usd.amountMinor, 1510) // 15.1 * 100 sin error de coma flotante
})

test("reembolso: parcial lleva el total reembolsado; total sin cifra usa el monto", async () => {
  const partial = await parse(
    providerWith(mpPayment({ transaction_amount_refunded: 5000 })).provider
  )
  const r1 = partial[1]
  assert.ok(r1.kind === "payment" && r1.type === "payment.refunded")
  assert.equal(r1.refundedMinor, 5000)
  const full = await parse(
    providerWith(mpPayment({ status: "refunded" })).provider
  )
  const r2 = full[1]
  assert.ok(r2.kind === "payment" && r2.type === "payment.refunded")
  assert.equal(r2.refundedMinor, 15000)
})

test("eventId estable entre reintentos y distinto entre estados", async () => {
  const a = await parse(providerWith(mpPayment()).provider)
  const b = await parse(providerWith(mpPayment()).provider)
  assert.deepEqual(
    a.map((e) => e.eventId),
    b.map((e) => e.eventId)
  )
  const pend = await parse(
    providerWith(mpPayment({ status: "pending" })).provider
  )
  assert.notEqual(a[0].eventId, pend[0].eventId)
  assert.equal(a[0].eventId, "payment:1001:approved:0")
})

// ── getPayment ───────────────────────────────────────────────────────────────

test("getPayment: id numérico consulta el pago", async () => {
  const { provider } = providerWith(mpPayment())
  const s = await provider.getPayment("1001")
  assert.deepEqual(s, {
    status: "approved",
    providerPaymentId: "1001",
    paymentId: "pay-1",
    amountMinor: 15000,
    currency: "CLP",
    refundedMinor: 0,
  })
})

test("getPayment: id de preferencia se resuelve por external_reference (aprobado primero)", async () => {
  const f = fakeFetch((c) => {
    if (c.url.endsWith("/checkout/preferences/123-abc"))
      return { json: { external_reference: "pay-1" } }
    if (c.url.includes("/v1/payments/search?external_reference=pay-1"))
      return {
        json: {
          results: [
            mpPayment({ id: 3, status: "rejected" }),
            mpPayment({ id: 2, status: "approved" }),
            mpPayment({
              id: 9,
              status: "approved",
              external_reference: "otro",
            }),
          ],
        },
      }
    return undefined
  })
  const p = createProvider(ENV, { fetch: f.fetch })!
  const s = await p.getPayment("123-abc")
  assert.equal(s.providerPaymentId, "2")
  assert.equal(s.status, "approved")
  assert.equal(s.paymentId, "pay-1")
})

test("getPayment: preferencia sin pagos → pending con el paymentId de la app", async () => {
  const f = fakeFetch((c) =>
    c.url.includes("/checkout/preferences/")
      ? { json: { external_reference: "pay-1" } }
      : { json: { results: [] } }
  )
  const p = createProvider(ENV, { fetch: f.fetch })!
  assert.deepEqual(await p.getPayment("123-abc"), {
    status: "pending",
    providerPaymentId: "123-abc",
    paymentId: "pay-1",
  })
})

test("getPayment: una referencia con caracteres raros no llega a la URL", async () => {
  const f = fakeFetch(() => ({ json: {} }))
  const p = createProvider(ENV, { fetch: f.fetch })!
  await assert.rejects(p.getPayment("../../x?y=1"), ProviderApiError)
  assert.equal(f.calls.length, 0)
})

// ── createCheckout ───────────────────────────────────────────────────────────

const checkoutInput = (environment: "sandbox" | "production") => ({
  paymentId: "pay-1",
  orderId: "order-1",
  amountMinor: 15000,
  currency: "CLP",
  description: SAMPLE_TEXT,
  payerEmail: "a@b.test",
  successUrl: "https://app.test/ok",
  failureUrl: "https://app.test/ko",
  pendingUrl: "https://app.test/wait",
  notificationUrl: "https://app.test/api/payments/webhook/mercadopago",
  environment,
})

test("createCheckout: preferencia con external_reference, monto y URLs; sandbox vs producción", async () => {
  const f = fakeFetch(() => ({
    json: {
      id: "pref-9",
      init_point: "https://mp.test/prod",
      sandbox_init_point: "https://mp.test/sandbox",
    },
  }))
  const p = createProvider(ENV, { fetch: f.fetch })!
  const sb = await p.createCheckout(checkoutInput("sandbox"))
  assert.deepEqual(sb, { id: "pref-9", url: "https://mp.test/sandbox" })
  const prod = await p.createCheckout(checkoutInput("production"))
  assert.equal(prod.url, "https://mp.test/prod")

  const c = f.calls[0]
  assert.equal(c.url, "https://api.mercadopago.com/checkout/preferences")
  assert.equal(c.method, "POST")
  assert.equal(c.headers.get("authorization"), `Bearer ${TOKEN}`)
  const body = JSON.parse(c.body!)
  assert.equal(body.external_reference, "pay-1")
  assert.equal(body.notification_url, checkoutInput("sandbox").notificationUrl)
  assert.equal(body.items[0].unit_price, 15000)
  assert.equal(body.items[0].currency_id, "CLP")
  assert.equal(body.back_urls.success, "https://app.test/ok")
})

// ── refund ───────────────────────────────────────────────────────────────────

test("refund: total sin monto; parcial con monto en unidad mayor", async () => {
  const f = fakeFetch((c) =>
    c.method === "GET"
      ? { json: mpPayment({ currency_id: "USD", transaction_amount: 20 }) }
      : { status: 201, json: {} }
  )
  const p = createProvider(ENV, { fetch: f.fetch })!
  await p.refund!("1001")
  await p.refund!("1001", 550)
  const posts = f.calls.filter((c) => c.method === "POST")
  assert.equal(
    posts[0].url,
    "https://api.mercadopago.com/v1/payments/1001/refunds"
  )
  assert.deepEqual(JSON.parse(posts[0].body!), {})
  assert.deepEqual(JSON.parse(posts[1].body!), { amount: 5.5 })
  assert.ok(posts[0].headers.get("x-idempotency-key"))
  assert.notEqual(
    posts[0].headers.get("x-idempotency-key"),
    posts[1].headers.get("x-idempotency-key")
  )
})

// ── errores de API sin filtrar ───────────────────────────────────────────────

test("error de API: solo el estado; ni el cuerpo ni el token en el mensaje", async () => {
  const leak = "DATOS-PERSONALES-juan@correo.test"
  const f = fakeFetch(() => ({
    status: 401,
    json: { message: leak, token: TOKEN },
  }))
  const p = createProvider(ENV, { fetch: f.fetch })!
  const ops: (() => Promise<unknown>)[] = [
    () => p.createCheckout(checkoutInput("sandbox")),
    () => p.getPayment("1001"),
    () => p.refund!("1001"),
    () => parse(p),
  ]
  for (const op of ops) {
    await assert.rejects(op(), (e: unknown) => {
      assert.ok(e instanceof ProviderApiError)
      assert.equal(e.status, 401)
      const dump = `${e.message} ${e.stack ?? ""} ${JSON.stringify(e)}`
      assert.ok(!dump.includes(leak), "filtró el cuerpo")
      assert.ok(!dump.includes(TOKEN), "filtró el token")
      return true
    })
  }
})

test("error de red: ProviderApiError sin el mensaje original", async () => {
  const p = createProvider(ENV, {
    fetch: (async () => {
      throw new Error(`boom ${TOKEN}`)
    }) as typeof fetch,
  })!
  await assert.rejects(p.getPayment("1001"), (e: unknown) => {
    assert.ok(e instanceof ProviderApiError)
    assert.ok(!e.message.includes(TOKEN))
    return true
  })
})

// ── punta a punta contra Postgres ────────────────────────────────────────────

const url = process.env.DATABASE_URL
const skip = url
  ? false
  : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `mp_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 4 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await up(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

const row = (id: string) =>
  db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow()

/** Crea un checkout real contra la BD, con la API de MP simulada. */
let mpSeq = 5000
async function newPayment(orderId: string, amountMinor = 15000) {
  const mpId = ++mpSeq // los eventId son únicos por proveedor: un id de MP distinto por prueba
  let state: Record<string, unknown> = {}
  let paymentId = ""
  const f = fakeFetch((c) => {
    if (c.url.endsWith("/checkout/preferences"))
      return {
        json: {
          id: "pref-e2e",
          init_point: "https://mp.test/p",
          sandbox_init_point: "https://mp.test/s",
        },
      }
    if (c.url.endsWith(`/v1/payments/${mpId}`))
      return {
        json: {
          ...mpPayment({ id: mpId, external_reference: paymentId }),
          ...state,
        },
      }
    return undefined
  })
  const provider = createProvider(ENV, { fetch: f.fetch })!
  const started = await startCheckout(
    db,
    {
      orderId,
      amountMinor,
      currency: "CLP",
      description: SAMPLE_TEXT,
      returnPath: "/orders/1",
    },
    {
      env: ENV,
      resolveProvider: async () => provider,
      getProvider: async () => provider,
    }
  )
  paymentId = started.paymentId
  return {
    paymentId,
    mpId: String(mpId),
    provider,
    setApi: (s: Record<string, unknown>) => (state = s),
  }
}

const eventsOf = (paymentId: string) =>
  db
    .selectFrom("payments_events")
    .selectAll()
    .where("payment_id", "=", paymentId)
    .execute()

test(
  "e2e: webhook firmado → handleWebhook → fila approved; 5 veces → un solo cambio",
  { skip },
  async () => {
    const { paymentId, mpId, provider } = await newPayment(
      `order-e2e-${Date.now()}`
    )
    assert.equal((await row(paymentId)).status, "pending")
    assert.equal((await row(paymentId)).checkout_url, "https://mp.test/s")

    for (let i = 0; i < 5; i++) {
      const { req } = webhookReq({ dataId: mpId })
      const res = await handleWebhook(async () => provider, req, db)
      assert.equal(res.status, 200)
    }
    const r = await row(paymentId)
    assert.equal(r.status, "approved")
    assert.equal(r.provider_payment_id, mpId)
    assert.equal(
      (await eventsOf(paymentId)).length,
      1,
      "un solo registro de evento"
    )
  }
)

test(
  "e2e: un webhook sin firma válida → 401 y la fila no cambia",
  { skip },
  async () => {
    const { paymentId, mpId, provider } = await newPayment(
      `order-e2e-bad-${Date.now()}`
    )
    const { req } = webhookReq({
      dataId: mpId,
      signature: sign(mpId, "req-1", "1700000000", "otro"),
    })
    const res = await handleWebhook(async () => provider, req, db)
    assert.equal(res.status, 401)
    assert.equal((await row(paymentId)).status, "pending")
    assert.equal((await eventsOf(paymentId)).length, 0)
  }
)

test(
  "e2e: cuerpo mentiroso firmado → la fila NO se aprueba",
  { skip },
  async () => {
    const { paymentId, mpId, provider, setApi } = await newPayment(
      `order-e2e-lie-${Date.now()}`
    )
    setApi({ status: "pending" })
    const { req } = webhookReq({
      dataId: mpId,
      body: { type: "payment", data: { id: mpId }, status: "approved" },
    })
    assert.equal(
      (await handleWebhook(async () => provider, req, db)).status,
      200
    )
    const r = await row(paymentId)
    assert.equal(r.status, "pending")
    assert.equal(r.approved_at, null)
  }
)

test(
  "e2e: monto distinto en la API → needs_review, no approved",
  { skip },
  async () => {
    const { paymentId, mpId, provider, setApi } = await newPayment(
      `order-e2e-amt-${Date.now()}`
    )
    setApi({ transaction_amount: 100 })
    const { req } = webhookReq({ dataId: mpId })
    await handleWebhook(async () => provider, req, db)
    assert.equal((await row(paymentId)).status, "needs_review")
  }
)

test(
  "e2e sandbox: syncPayment por id de preferencia (sin webhook) aprueba; reembolso parcial y total",
  { skip },
  async () => {
    const { paymentId, provider, setApi } = await newPayment(
      `order-e2e-sync-${Date.now()}`
    )
    const f = fakeFetch((c) => {
      if (c.url.endsWith("/checkout/preferences/pref-e2e"))
        return { json: { external_reference: paymentId } }
      if (c.url.includes("/v1/payments/search"))
        return {
          json: { results: [mpPayment({ external_reference: paymentId })] },
        }
      return undefined
    })
    const viaPref = createProvider(ENV, { fetch: f.fetch })!
    void provider
    void setApi
    const rec = await syncPayment(db, paymentId, undefined, {
      env: ENV,
      getProvider: async () => viaPref,
    })
    assert.equal(rec.status, "approved")
    assert.equal(rec.providerPaymentId, "1001")

    // un id de pago ajeno (de otra referencia) se rechaza
    const other = fakeFetch(() => ({
      json: mpPayment({ external_reference: "otro-pago" }),
    }))
    await assert.rejects(
      syncPayment(db, paymentId, "1001", {
        env: ENV,
        getProvider: async () => createProvider(ENV, { fetch: other.fetch })!,
      }),
      /no corresponde/
    )

    // reembolso parcial confirmado por la API → sigue approved con refunded_minor
    const part = fakeFetch(() => ({
      json: mpPayment({
        external_reference: paymentId,
        transaction_amount_refunded: 5000,
      }),
    }))
    await syncPayment(db, paymentId, "1001", {
      env: ENV,
      getProvider: async () => createProvider(ENV, { fetch: part.fetch })!,
    })
    let r = await row(paymentId)
    assert.equal(r.status, "approved")
    assert.equal(Number(r.refunded_minor), 5000)

    const full = fakeFetch(() => ({
      json: mpPayment({
        external_reference: paymentId,
        status: "refunded",
        transaction_amount_refunded: 15000,
      }),
    }))
    await syncPayment(db, paymentId, "1001", {
      env: ENV,
      getProvider: async () => createProvider(ENV, { fetch: full.fetch })!,
    })
    r = await row(paymentId)
    assert.equal(r.status, "refunded")
  }
)
