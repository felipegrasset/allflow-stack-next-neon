/**
 * Adaptador de Flow, sin red: `fetch` simulado. Las llaves son marcadores.
 * La última sección va contra Postgres (DATABASE_URL) de punta a punta.
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
  type PaymentProvider,
} from "../contracts/types"
import { createProvider, sign } from "../providers/flow"
import { startCheckout, syncPayment } from "../server/checkout"
import { handleWebhook } from "../server/webhook"

const API_KEY = "test-api-key"
const SECRET = "test-secret-key"
const ENV = {
  FLOW_API_KEY: API_KEY,
  FLOW_SECRET_KEY: SECRET,
  PAYMENTS_ENV: "sandbox",
  BETTER_AUTH_URL: "https://app.test",
}
const SAMPLE_TEXT = "Pedido de prueba"
const UNKNOWN_TOKEN_MSG = "token inexistente"
const BODY_LEAK = "CUERPO-SECRETO-DE-FLOW-con-datos-personales"

type Call = { url: URL; method: string; params: URLSearchParams }

/** Un Flow de mentira: registra cada llamada y responde lo que diga `handler`. */
function fakeFlow(
  handler: (c: Call) => { status?: number; json?: unknown } | undefined
) {
  const calls: Call[] = []
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = new URL(String(input))
    const method = init?.method ?? "GET"
    const params =
      method === "GET"
        ? url.searchParams
        : new URLSearchParams(String(init?.body ?? ""))
    const call = { url, method, params }
    calls.push(call)
    const out = handler(call) ?? { status: 400, json: { message: "nope" } }
    return new Response(JSON.stringify(out.json ?? {}), {
      status: out.status ?? 200,
    })
  }) as typeof fetch
  return { calls, fetch: fetchFn }
}

const statusBody = (over: Record<string, unknown> = {}) => ({
  flowOrder: 4242,
  commerceOrder: "pay-1",
  status: 2,
  currency: "CLP",
  amount: "15000",
  payer: "cliente@test.example",
  ...over,
})

const form = (o: Record<string, string>) =>
  new Request("https://app.test/api/payments/webhook/flow", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(o).toString(),
  })
const post = (p: PaymentProvider, o: Record<string, string>) => {
  const req = form(o)
  return req.text().then((raw) => p.parseWebhook(req, raw))
}

function provider(
  handler: Parameters<typeof fakeFlow>[0],
  env: Record<string, string> = ENV
) {
  const f = fakeFlow(handler)
  const p = createProvider(env, { fetch: f.fetch })
  assert.ok(p)
  return { p, calls: f.calls }
}

// ── firma ────────────────────────────────────────────────────────────────────

test("sign: coincide con el ejemplo de la doc (orden alfabético, nombre+valor, HMAC-SHA256 hex)", () => {
  const expected = createHmac("sha256", "k")
    .update("amount5000apiKeyAAAAcurrencyCLP")
    .digest("hex")
  assert.equal(
    sign({ currency: "CLP", apiKey: "AAAA", amount: 5000 }, "k"),
    expected
  )
})

test("sign: determinista, ignora `s` y undefined, y cambia si cambia un valor, la llave o el nombre", () => {
  const base = { amount: 5000, apiKey: "AAAA", currency: "CLP" }
  assert.equal(sign(base, "k"), sign({ ...base }, "k"))
  assert.equal(
    sign({ ...base, s: "x", extra: undefined }, "k"),
    sign(base, "k")
  )
  assert.notEqual(sign({ ...base, amount: 5001 }, "k"), sign(base, "k"))
  assert.notEqual(sign(base, "k2"), sign(base, "k"))
  assert.notEqual(
    sign({ amount: 5000, apiKey: "AAAA", currencz: "CLP" }, "k"),
    sign(base, "k")
  )
  // el orden de inserción no importa; el alfabético sí: ordenar mal daría otra firma
  assert.equal(
    sign({ currency: "CLP", amount: 5000, apiKey: "AAAA" }, "k"),
    sign(base, "k")
  )
  assert.notEqual(
    sign(base, "k"),
    createHmac("sha256", "k")
      .update("apiKeyAAAAamount5000currencyCLP")
      .digest("hex")
  )
})

test("cada llamada lleva `s` válida y NUNCA envía la secretKey", async () => {
  const { p, calls } = provider((c) => {
    if (c.url.pathname.endsWith("/payment/create"))
      return {
        json: {
          url: "https://sandbox.flow.cl/app/web/pay.php",
          token: "TOK1",
          flowOrder: 1,
        },
      }
    if (c.url.pathname.endsWith("/payment/getStatus"))
      return { json: statusBody() }
    if (c.url.pathname.endsWith("/payment/getStatusByFlowOrder"))
      return { json: statusBody() }
    return { json: {} }
  })
  await p.createCheckout({
    paymentId: "pay-1",
    orderId: "o1",
    amountMinor: 15000,
    currency: "CLP",
    description: "Pedido",
    payerEmail: "cliente@test.example",
    successUrl: "https://app.test/ok",
    failureUrl: "https://app.test/ok",
    pendingUrl: "https://app.test/ok",
    notificationUrl: "https://app.test/api/payments/webhook/flow",
    environment: "sandbox",
  })
  await post(p, { token: "TOK1" })
  await p.getPayment("TOK1")
  await p.getPayment("4242")
  await p.refund!("4242")
  assert.ok(calls.length >= 6)
  for (const c of calls) {
    const sent = c.params.get("s")
    assert.ok(sent, `${c.url.pathname} sin firma`)
    const bag = Object.fromEntries(c.params)
    assert.equal(bag.apiKey, API_KEY)
    assert.equal(sent, sign(bag, SECRET), `${c.url.pathname}: firma inválida`)
    assert.ok(!c.url.toString().includes(SECRET))
    assert.ok(!c.params.toString().includes(SECRET))
  }
})

test("createCheckout: parámetros, CLP sin decimales, enlace url?token= y id = token", async () => {
  const { p, calls } = provider(() => ({
    json: {
      url: "https://sandbox.flow.cl/app/web/pay.php",
      token: "TOK1",
      flowOrder: 9,
    },
  }))
  const out = await p.createCheckout({
    paymentId: "pay-9",
    orderId: "o9",
    amountMinor: 15000,
    currency: "CLP",
    description: SAMPLE_TEXT,
    payerEmail: "a@test.example",
    successUrl: "https://app.test/back",
    failureUrl: "https://app.test/back",
    pendingUrl: "https://app.test/back",
    notificationUrl: "https://app.test/api/payments/webhook/flow",
    environment: "sandbox",
  })
  assert.deepEqual(out, {
    id: "TOK1",
    url: "https://sandbox.flow.cl/app/web/pay.php?token=TOK1",
  })
  const c = calls[0]!
  assert.equal(
    c.url.origin + c.url.pathname,
    "https://sandbox.flow.cl/api/payment/create"
  )
  assert.equal(c.method, "POST")
  assert.equal(c.params.get("commerceOrder"), "pay-9")
  assert.equal(c.params.get("amount"), "15000") // no "15000.00", no 150
  assert.equal(c.params.get("currency"), "CLP")
  assert.equal(c.params.get("email"), "a@test.example")
  assert.equal(
    c.params.get("urlConfirmation"),
    "https://app.test/api/payments/webhook/flow"
  )
  assert.equal(c.params.get("urlReturn"), "https://app.test/back")
})

test("la base URL depende del entorno", async () => {
  const prod = provider(() => ({ json: statusBody() }), {
    ...ENV,
    PAYMENTS_ENV: "production",
  })
  await prod.p.getPayment("TOK1")
  assert.equal(prod.calls[0]!.url.origin, "https://www.flow.cl")
  const sb = provider(() => ({ json: statusBody() }))
  await sb.p.getPayment("TOK1")
  assert.equal(sb.calls[0]!.url.origin, "https://sandbox.flow.cl")
})

test("sin llaves devuelve null; con una sola lanza", () => {
  assert.equal(createProvider({}), null)
  assert.throws(
    () => createProvider({ FLOW_API_KEY: API_KEY }),
    /FLOW_SECRET_KEY/
  )
})

// ── webhook: se confirma con getStatus, el cuerpo no cuenta ──────────────────

test("sin token → WebhookAuthError y no se llama a Flow", async () => {
  const { p, calls } = provider(() => ({ json: statusBody() }))
  await assert.rejects(() => post(p, {}), WebhookAuthError)
  await assert.rejects(() => post(p, { token: "  " }), WebhookAuthError)
  await assert.rejects(
    () => post(p, { status: "2", amount: "1" }),
    WebhookAuthError
  )
  assert.equal(calls.length, 0)
})

test("token desconocido (Flow responde 4xx) → WebhookAuthError", async () => {
  for (const status of [400, 401, 404]) {
    const { p } = provider(() => ({ status, json: { message: BODY_LEAK } }))
    await assert.rejects(
      () => post(p, { token: "FAKE" }),
      (e) =>
        e instanceof WebhookAuthError && !String(e.message).includes(BODY_LEAK)
    )
  }
})

test("el cuerpo mentiroso (status/amount/commerceOrder en el POST) se ignora: manda getStatus", async () => {
  const { p, calls } = provider((c) =>
    c.url.pathname.endsWith("/payment/getStatus")
      ? { json: statusBody({ status: 1, amount: "15000" }) }
      : undefined
  )
  const evs = await post(p, {
    token: "TOK1",
    status: "2",
    amount: "1",
    commerceOrder: "otra-orden",
    flowOrder: "999",
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url.pathname, "/api/payment/getStatus")
  assert.equal(calls[0]!.params.get("token"), "TOK1")
  assert.equal(evs.length, 1)
  assert.equal(evs[0]!.type, "payment.pending") // no "approved": mintió el cuerpo
  assert.equal((evs[0] as { paymentId?: string }).paymentId, "pay-1")
  assert.equal(
    (evs[0] as { providerPaymentId: string }).providerPaymentId,
    "4242"
  )
})

test("estados de Flow → eventos (1 pendiente, 2 pagada, 3 rechazada, 4 anulada); monto CLP entero", async () => {
  const expected: Record<number, string> = {
    1: "payment.pending",
    2: "payment.approved",
    3: "payment.failed",
    4: "payment.failed",
  }
  for (const [st, type] of Object.entries(expected)) {
    const { p } = provider(() => ({
      json: statusBody({ status: Number(st), amount: 15000 }),
    }))
    const [ev] = await post(p, { token: "TOK1" })
    assert.equal(ev!.type, type, `status ${st}`)
    assert.equal(ev!.provider, "flow")
    assert.equal(ev!.eventId, `flow:4242:${st}`)
    if (ev!.type === "payment.approved") {
      assert.equal(ev.amountMinor, 15000)
      assert.equal(ev.currency, "CLP")
    }
  }
  // el mismo aviso repetido produce el mismo eventId
  const { p } = provider(() => ({ json: statusBody() }))
  const a = await post(p, { token: "TOK1" })
  const b = await post(p, { token: "TOK1" })
  assert.equal(a[0]!.eventId, b[0]!.eventId)
})

test("una respuesta ilegible o con estado desconocido no se interpreta (ProviderApiError, no evento)", async () => {
  for (const body of [
    statusBody({ status: 9 }),
    statusBody({ flowOrder: "x" }),
    statusBody({ commerceOrder: "" }),
    statusBody({ amount: "abc" }),
  ]) {
    const { p } = provider(() => ({ json: body }))
    await assert.rejects(() => post(p, { token: "TOK1" }), ProviderApiError)
  }
})

test("un 5xx de Flow no es un rechazo de autenticación: se reintenta", async () => {
  const { p } = provider(() => ({ status: 503, json: { message: BODY_LEAK } }))
  await assert.rejects(
    () => post(p, { token: "TOK1" }),
    (e) => e instanceof ProviderApiError && e.status === 503
  )
})

test("el aviso de un reembolso (token de refund) se autentica con refund/getStatus y no genera eventos", async () => {
  const { p, calls } = provider((c) =>
    c.url.pathname.endsWith("/refund/getStatus")
      ? { json: { token: "RT", status: "created" } }
      : undefined
  )
  assert.deepEqual(await post(p, { token: "RT" }), [])
  assert.deepEqual(
    calls.map((c) => c.url.pathname),
    ["/api/payment/getStatus", "/api/refund/getStatus"]
  )
})

// ── getPayment y refund ──────────────────────────────────────────────────────

test("getPayment: acepta token o flowOrder y siempre devuelve providerPaymentId = flowOrder", async () => {
  const { p, calls } = provider(() => ({ json: statusBody() }))
  const byToken = await p.getPayment("TOKENabc123")
  const byOrder = await p.getPayment("4242")
  assert.equal(calls[0]!.url.pathname, "/api/payment/getStatus")
  assert.equal(calls[0]!.params.get("token"), "TOKENabc123")
  assert.equal(calls[1]!.url.pathname, "/api/payment/getStatusByFlowOrder")
  assert.equal(calls[1]!.params.get("flowOrder"), "4242")
  assert.deepEqual(byToken, byOrder)
  assert.deepEqual(byToken, {
    status: "approved",
    providerPaymentId: "4242",
    paymentId: "pay-1",
    amountMinor: 15000,
    currency: "CLP",
  })
})

test("refund: usa flowOrder, el email del pago, CLP entero; no reembolsa un pago no pagado", async () => {
  const { p, calls } = provider((c) => {
    if (c.url.pathname.endsWith("/payment/getStatusByFlowOrder"))
      return { json: statusBody() }
    if (c.url.pathname.endsWith("/refund/create"))
      return { json: { token: "RT", flowRefundOrder: 1 } }
    return undefined
  })
  await p.refund!("4242", 5000)
  const r = calls.find((c) => c.url.pathname.endsWith("/refund/create"))!
  assert.equal(r.method, "POST")
  assert.equal(r.params.get("flowTrxId"), "4242")
  assert.equal(r.params.get("receiverEmail"), "cliente@test.example")
  assert.equal(r.params.get("amount"), "5000")
  assert.equal(
    r.params.get("urlCallBack"),
    "https://app.test/api/payments/webhook/flow"
  )
  assert.equal(r.params.get("refundCommerceOrder"), "rf-4242-5000")
  await assert.rejects(() => p.refund!("4242", 15001), /inválido/)
  await assert.rejects(() => p.refund!("TOKENabc123"), /flowOrder/)

  const pend = provider(() => ({ json: statusBody({ status: 1 }) }))
  await assert.rejects(() => pend.p.refund!("4242"), /pagado/)
  assert.ok(!pend.calls.some((c) => c.url.pathname.endsWith("/refund/create")))
})

test("error de API: solo el estado; ni cuerpo ni llaves en el mensaje (también en errores de red)", async () => {
  const { p } = provider(() => ({ status: 500, json: { message: BODY_LEAK } }))
  await assert.rejects(
    () => p.getPayment("TOK1"),
    (e) => {
      assert.ok(e instanceof ProviderApiError)
      assert.equal(e.status, 500)
      const text = `${e.message} ${e.stack ?? ""} ${JSON.stringify(e)}`
      for (const secret of [BODY_LEAK, SECRET, API_KEY])
        assert.ok(!text.includes(secret))
      return true
    }
  )
  const net = createProvider(ENV, {
    fetch: (async () => {
      throw new Error(`ECONNRESET https://x?apiKey=${API_KEY}&s=firma`)
    }) as typeof fetch,
  })!
  await assert.rejects(
    () => net.getPayment("TOK1"),
    (e) => e instanceof ProviderApiError && !String(e.message).includes(API_KEY)
  )
})

// ── punta a punta contra Postgres ────────────────────────────────────────────

const url = process.env.DATABASE_URL
const skip = url
  ? false
  : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `flow_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
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

/** Flow de mentira con estado: recuerda el commerceOrder del `payment/create` y lo devuelve en getStatus. */
function statefulFlow(paid: { amount: number; status: number }) {
  let commerceOrder = ""
  return fakeFlow((c) => {
    if (c.url.pathname.endsWith("/payment/create")) {
      commerceOrder = c.params.get("commerceOrder")!
      return {
        json: {
          url: "https://sandbox.flow.cl/app/web/pay.php",
          token: "TOK-E2E",
          flowOrder: 777,
        },
      }
    }
    if (c.url.pathname.endsWith("/payment/getStatusByFlowOrder")) {
      return c.params.get("flowOrder") === "777"
        ? {
            json: statusBody({
              flowOrder: 777,
              commerceOrder,
              status: paid.status,
              amount: String(paid.amount),
            }),
          }
        : { status: 400, json: {} }
    }
    if (c.url.pathname.endsWith("/payment/getStatus")) {
      return c.params.get("token") === "TOK-E2E"
        ? {
            json: statusBody({
              flowOrder: 777,
              commerceOrder,
              status: paid.status,
              amount: String(paid.amount),
            }),
          }
        : { status: 400, json: { message: UNKNOWN_TOKEN_MSG } }
    }
    return undefined
  })
}

async function rowFor(paymentId: string) {
  return db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", paymentId)
    .executeTakeFirstOrThrow()
}
const eventCount = async (paymentId: string) =>
  (
    await db
      .selectFrom("payments_events")
      .selectAll()
      .where("payment_id", "=", paymentId)
      .execute()
  ).length

test(
  "E2E: checkout → notificación de Flow → handleWebhook → approved; el mismo aviso 5 veces = un cambio",
  { skip },
  async () => {
    const flow = statefulFlow({ amount: 15000, status: 2 })
    const p = createProvider(ENV, { fetch: flow.fetch })!
    const { paymentId, url: payUrl } = await startCheckout(
      db,
      {
        orderId: `order-e2e-${Math.random().toString(36).slice(2, 8)}`,
        amountMinor: 15000,
        currency: "CLP",
        description: SAMPLE_TEXT,
        payerEmail: "cliente@test.example",
        returnPath: "/orders/1",
        provider: "flow",
      },
      { env: ENV, resolveProvider: async () => p, getProvider: async () => p }
    )
    assert.equal(
      payUrl,
      "https://sandbox.flow.cl/app/web/pay.php?token=TOK-E2E"
    )
    assert.equal((await rowFor(paymentId)).external_id, "TOK-E2E")
    assert.equal((await rowFor(paymentId)).status, "pending")

    for (let i = 0; i < 5; i++) {
      const res = await handleWebhook(
        async () => p,
        form({ token: "TOK-E2E" }),
        db
      )
      assert.equal(res.status, 200)
    }
    const row = await rowFor(paymentId)
    assert.equal(row.status, "approved")
    assert.equal(row.provider_payment_id, "777")
    assert.equal(await eventCount(paymentId), 1)

    // syncPayment (al volver del checkout) con el token y con el flowOrder: mismo pago, sin cambios nuevos
    const synced = await syncPayment(db, paymentId, undefined, {
      env: ENV,
      getProvider: async () => p,
    })
    assert.equal(synced.status, "approved")
  }
)

test(
  "E2E: un token que Flow no reconoce → 401 y no se escribe nada; el cuerpo mentiroso no aprueba",
  { skip },
  async () => {
    const flow = statefulFlow({ amount: 15000, status: 1 })
    const p = createProvider(ENV, { fetch: flow.fetch })!
    const { paymentId } = await startCheckout(
      db,
      {
        orderId: `order-e2e-${Math.random().toString(36).slice(2, 8)}`,
        amountMinor: 15000,
        currency: "CLP",
        description: SAMPLE_TEXT,
        payerEmail: "cliente@test.example",
        returnPath: "/orders/1",
        provider: "flow",
      },
      { env: ENV, resolveProvider: async () => p, getProvider: async () => p }
    )
    const bad = await handleWebhook(async () => p, form({ token: "FALSO" }), db)
    assert.equal(bad.status, 401)
    const liar = await handleWebhook(
      async () => p,
      form({
        token: "TOK-E2E",
        status: "2",
        amount: "15000",
        commerceOrder: paymentId,
      }),
      db
    )
    assert.equal(liar.status, 200)
    assert.equal((await rowFor(paymentId)).status, "pending") // Flow dijo 1, no "2"
    assert.equal((await rowFor(paymentId)).approved_at, null)
  }
)
