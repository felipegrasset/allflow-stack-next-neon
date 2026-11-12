/**
 * payments — lo que se prueba SIN base de datos: la máquina de estados, el
 * orden del webhook (autenticar antes de tocar la base), la configuración y el
 * log. Cada caso puede fallar: ver `payments-db.test.ts` para lo que necesita
 * Postgres (idempotencia concurrente, atomicidad, carreras).
 */
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { checkoutInputSchema, INTERNAL_PATH } from "../contracts/input"
import { majorToMinor, minorToMajor } from "../contracts/money"
import {
  ProviderNotConfiguredError,
  WebhookAuthError,
  type PaymentEvent,
  type PaymentProvider,
} from "../contracts/types"
import { decidePayment } from "../server/apply"
import {
  appBaseUrl,
  paymentsEnvironment,
  readProviderEnv,
  webhookUrl,
} from "../server/config"
import { paymentsLog } from "../server/log"
import { findProvider, resolveProvider } from "../server/registry"
import { handleWebhook } from "../server/webhook"

// ── máquina de estados ───────────────────────────────────────────────────────

type Pay = Parameters<typeof decidePayment>[0]
const pay = (over: Partial<Pay> = {}): Pay => ({
  status: "pending",
  amount_minor: "15000",
  currency: "CLP",
  refunded_minor: "0",
  provider_payment_id: null,
  ...over,
})
const approved = (
  over: Partial<Extract<PaymentEvent, { type: "payment.approved" }>> = {}
): Extract<PaymentEvent, { type: "payment.approved" }> => ({
  kind: "payment",
  type: "payment.approved",
  provider: "mercadopago",
  eventId: "e1",
  providerPaymentId: "mp-1",
  amountMinor: 15000,
  currency: "CLP",
  ...over,
})
const refunded = (
  refundedMinor: number
): Extract<PaymentEvent, { type: "payment.refunded" }> => ({
  kind: "payment",
  type: "payment.refunded",
  provider: "mercadopago",
  eventId: "r1",
  providerPaymentId: "mp-1",
  refundedMinor,
})

test("aprobado con el monto de la orden: pending → approved", () => {
  const d = decidePayment(pay(), approved())
  assert.equal(d.outcome, "applied")
  assert.equal(d.patch?.status, "approved")
  assert.equal(d.patch?.approvedNow, true)
})

test("PAY-5: monto distinto al de la orden → needs_review, jamás approved", () => {
  for (const ev of [
    approved({ amountMinor: 1 }), // pagó de menos
    approved({ amountMinor: 150000 }), // pagó de más
    approved({ currency: "USD" }), // otra moneda
  ]) {
    const d = decidePayment(pay(), ev)
    assert.equal(d.outcome, "amount_mismatch")
    assert.equal(d.patch?.status, "needs_review")
  }
})

test("la moneda se compara sin importar mayúsculas ni el relleno de char(3)", () => {
  const d = decidePayment(
    pay({ currency: "CLP " }),
    approved({ currency: "clp" })
  )
  assert.equal(d.outcome, "applied")
})

test("un evento tardío no baja un pago aprobado", () => {
  const p = pay({ status: "approved" })
  for (const type of ["payment.pending", "payment.failed"] as const) {
    const d = decidePayment(p, {
      kind: "payment",
      type,
      provider: "flow",
      eventId: "x",
      providerPaymentId: "x",
    })
    assert.deepEqual(d, { outcome: "noop", patch: null })
  }
})

test("failed no es terminal: un reintento aprobado en la misma preferencia sí aprueba", () => {
  assert.equal(
    decidePayment(pay({ status: "failed" }), approved()).patch?.status,
    "approved"
  )
  assert.equal(
    decidePayment(pay({ status: "failed" }), {
      kind: "payment",
      type: "payment.pending",
      provider: "flow",
      eventId: "x",
      providerPaymentId: "x",
    }).patch?.status,
    "pending"
  )
})

test("plata sobre un checkout cancelado → needs_review, no approved", () => {
  const d = decidePayment(pay({ status: "canceled" }), approved())
  assert.equal(d.outcome, "needs_review")
  assert.equal(d.patch?.status, "needs_review")
})

test("un segundo pago aprobado distinto sobre una orden ya pagada se marca, sin tocar el estado", () => {
  const p = pay({ status: "approved", provider_payment_id: "mp-1" })
  const d = decidePayment(p, approved({ providerPaymentId: "mp-2" }))
  assert.equal(d.outcome, "needs_review")
  assert.equal(d.patch, null)
  // el mismo pago repetido es un noop
  assert.equal(decidePayment(p, approved()).outcome, "noop")
})

test("reembolsos: parcial deja approved, total pasa a refunded, y es monótono", () => {
  const p = pay({ status: "approved" })
  const partial = decidePayment(p, refunded(5000))
  assert.equal(partial.patch?.status, "approved")
  assert.equal(partial.patch?.refundedMinor, 5000)

  const full = decidePayment(p, refunded(15000))
  assert.equal(full.patch?.status, "refunded")

  // llega primero el de 15000 y después uno viejo de 5000: no retrocede
  const after = pay({ status: "refunded", refunded_minor: "15000" })
  assert.equal(decidePayment(after, refunded(5000)).outcome, "noop")

  // más de lo cobrado: una persona lo mira
  assert.equal(decidePayment(p, refunded(15001)).outcome, "needs_review")
})

test("un reembolso sobre un pago que nunca se aprobó → needs_review", () => {
  assert.equal(decidePayment(pay(), refunded(100)).outcome, "needs_review")
})

// ── el webhook: autenticar antes de tocar la base ────────────────────────────

/** Una base que revienta al tocarla: probar que no se escribió = que no se usó. */
const explodingDb = new Proxy(
  {},
  {
    get() {
      throw new Error("el webhook tocó la base")
    },
  }
) as Kysely<Database>

const fakeProvider = (
  parse: PaymentProvider["parseWebhook"]
): PaymentProvider => ({
  id: "mercadopago",
  createCheckout: async () => ({ id: "x", url: "https://x" }),
  getPayment: async () => {
    throw new Error("no se usa")
  },
  parseWebhook: parse,
})
const post = (body = "{}") =>
  new Request("https://app.test/api/payments/webhook/mercadopago", {
    method: "POST",
    body,
  })

test("PAY-3: si no se puede autenticar → 401 y la base ni se toca", async () => {
  const res = await handleWebhook(
    async () =>
      fakeProvider(async () => {
        throw new WebhookAuthError("bad_signature")
      }),
    post(),
    explodingDb
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: "unauthorized" })
})

test("PAY-3: proveedor con la configuración a medias (falta el secreto) → 401, no acepta", async () => {
  const res = await handleWebhook(
    async () => {
      throw new ProviderNotConfiguredError("mercadopago", [
        "MERCADOPAGO_WEBHOOK_SECRET",
      ])
    },
    post(),
    explodingDb
  )
  assert.equal(res.status, 401)
})

test("proveedor desconocido o sin configurar → 404, sin tocar la base", async () => {
  const res = await handleWebhook(async () => null, post(), explodingDb)
  assert.equal(res.status, 404)
})

test("cuerpo gigante → 413 antes de parsear", async () => {
  let parsed = false
  const res = await handleWebhook(
    async () =>
      fakeProvider(async () => {
        parsed = true
        return []
      }),
    post("x".repeat(300 * 1024)),
    explodingDb
  )
  assert.equal(res.status, 413)
  assert.equal(parsed, false)
})

test("un error al consultar al proveedor responde 502 (reintenta) y no escribe", async () => {
  const res = await handleWebhook(
    async () =>
      fakeProvider(async () => {
        throw new Error("ECONNRESET con datos de la persona")
      }),
    post(),
    explodingDb
  )
  assert.equal(res.status, 502)
  assert.doesNotMatch(await res.text(), /ECONNRESET/)
})

test("notificación autenticada sin eventos relevantes → 200 y la base ni se toca", async () => {
  const res = await handleWebhook(
    async () => fakeProvider(async () => []),
    post(),
    explodingDb
  )
  assert.equal(res.status, 200)
})

// ── configuración ────────────────────────────────────────────────────────────

test("PAYMENTS_ENV: sandbox salvo que diga exactamente production", () => {
  assert.equal(paymentsEnvironment({}), "sandbox")
  assert.equal(paymentsEnvironment({ PAYMENTS_ENV: "prod" }), "sandbox")
  assert.equal(paymentsEnvironment({ PAYMENTS_ENV: "Production" }), "sandbox")
  assert.equal(
    paymentsEnvironment({ PAYMENTS_ENV: "production" }),
    "production"
  )
})

test("readProviderEnv: nada definido → null; a medias → lanza nombrando la variable, no su valor", () => {
  assert.equal(
    readProviderEnv("flow", ["FLOW_API_KEY", "FLOW_SECRET_KEY"], {}),
    null
  )
  assert.throws(
    () =>
      readProviderEnv("flow", ["FLOW_API_KEY", "FLOW_SECRET_KEY"], {
        FLOW_API_KEY: "super-secreto-123",
      }),
    (e: Error) =>
      e instanceof ProviderNotConfiguredError &&
      e.message.includes("FLOW_SECRET_KEY") &&
      !e.message.includes("super-secreto-123")
  )
})

test("URLs: usa PAYMENTS_BASE_URL, luego BETTER_AUTH_URL; sin ninguna lanza", () => {
  assert.equal(
    webhookUrl("flow", {
      PAYMENTS_BASE_URL: "https://a.test/",
      BETTER_AUTH_URL: "https://b.test",
    }),
    "https://a.test/api/payments/webhook/flow"
  )
  assert.equal(
    appBaseUrl({ BETTER_AUTH_URL: "https://b.test" }),
    "https://b.test"
  )
  assert.throws(() => appBaseUrl({}))
})

test("registro: sin configuración no elige nada; pedir Paddle por nombre se respeta (y no se cae a otro)", async () => {
  // Con los stubs actuales ningún proveedor está configurado: no hay elección automática.
  await assert.rejects(
    () => resolveProvider(undefined, {}),
    ProviderNotConfiguredError
  )
  await assert.rejects(
    () => resolveProvider(undefined, { PAYMENTS_PROVIDER: "paddle" }),
    ProviderNotConfiguredError // se respetó el nombre; falta su configuración
  )
  assert.equal(await findProvider("nope", {}), null)
})

// ── entrada de la app ────────────────────────────────────────────────────────

test("returnPath solo acepta rutas internas (sin redirección abierta)", () => {
  for (const ok of ["/orders/42", "/", "/a?b=1#c"])
    assert.ok(INTERNAL_PATH.test(ok), ok)
  for (const bad of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "orders",
    "/a b",
    "javascript:1",
  ]) {
    assert.ok(!INTERNAL_PATH.test(bad), `debía rechazar ${bad}`)
  }
})

test("checkout: monto entero positivo, moneda válida, normalizada a mayúsculas", () => {
  const base = { orderId: "o1", description: "Pedido", returnPath: "/o/1" }
  assert.equal(
    checkoutInputSchema.parse({ ...base, amountMinor: 1500, currency: "clp" })
      .currency,
    "CLP"
  )
  for (const amountMinor of [
    0,
    -5,
    1.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      checkoutInputSchema.safeParse({ ...base, amountMinor, currency: "CLP" })
        .success,
      false,
      String(amountMinor)
    )
  }
  assert.equal(
    checkoutInputSchema.safeParse({ ...base, amountMinor: 1, currency: "ZZZ9" })
      .success,
    false
  )
})

test("dinero: CLP sin decimales, USD con dos; sin errores de coma flotante", () => {
  assert.equal(minorToMajor(1500, "CLP"), 1500)
  assert.equal(minorToMajor(1550, "USD"), 15.5)
  assert.equal(majorToMinor(15.5, "USD"), 1550)
  assert.equal(majorToMinor(19.99, "USD"), 1999) // 19.99 * 100 = 1998.9999999999998
  assert.equal(majorToMinor(1500, "CLP"), 1500)
})

// ── PAY-4: nada de secretos en el log ────────────────────────────────────────

test("PAY-4: el log es una lista blanca; un campo extra con una llave no sale", () => {
  const line = paymentsLog({
    at: "webhook",
    provider: "flow",
    outcome: "applied",
    // @ts-expect-error — un campo que no está en la lista blanca
    accessToken: "APP_USR-secreto",
    authorization: "Bearer secreto",
  })
  assert.doesNotMatch(line, /secreto|APP_USR|Bearer/)
  assert.match(line, /"provider":"flow"/)
})

test("PAY-4: el código del módulo no escribe en consola salvo por server/log.ts", () => {
  const root = join(process.cwd(), "modules/payments")
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== "tests") walk(p)
      } else if (/\.tsx?$/.test(name) && !p.endsWith("server/log.ts")) {
        if (
          /console\.(log|info|warn|error|debug)/.test(readFileSync(p, "utf8"))
        ) {
          offenders.push(p.slice(root.length + 1))
        }
      }
    }
  }
  walk(root)
  assert.deepEqual(offenders, [])
})

// ── no hay ruta para simular pagos ───────────────────────────────────────────

test("no existe ninguna ruta de «simular pago» en la app ni en el módulo", () => {
  const found: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (name === "node_modules" || name === ".next" || name === "tests")
        continue
      if (statSync(p).isDirectory()) walk(p)
      else if (/simul|fake-?pay|mock-?pay|pagar-?demo/i.test(p)) found.push(p)
    }
  }
  walk(join(process.cwd(), "app"))
  walk(join(process.cwd(), "modules/payments"))
  assert.deepEqual(found, [])
})
