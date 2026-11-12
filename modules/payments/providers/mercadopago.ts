import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import {
  ProviderApiError,
  WebhookAuthError,
  type PaymentEvent,
  type PaymentProvider,
  type ProviderCheckout,
  type ProviderCheckoutInput,
  type ProviderPaymentState,
} from "../contracts/types"
import { majorToMinor, minorToMajor } from "../contracts/money"
import { readProviderEnv, type Env } from "../server/config"

/**
 * Mercado Pago (Checkout Pro) por REST, sin SDK. Las mismas variables sirven
 * para las llaves de Fulvia y las del cliente (BYOK):
 *   MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET.
 *
 * Sin suscripciones (`createSubscription` / `cancelSubscription` no existen
 * aquí a propósito). El sandbox de MP NO envía webhooks con credenciales de
 * prueba: ahí la vía real es `syncPayment` → `getPayment`.
 */

const API = "https://api.mercadopago.com"
const PROVIDER = "mercadopago" as const
const TIMEOUT_MS = 15_000

type Deps = { fetch?: typeof fetch }
type Config = { accessToken: string; webhookSecret: string }

type MpPayment = {
  id?: number | string
  status?: string
  external_reference?: string | null
  currency_id?: string
  transaction_amount?: number
  transaction_amount_refunded?: number
  date_created?: string
}

const isNumericId = (s: string) => /^\d{1,20}$/.test(s)

/**
 * Valida `x-signature` (`ts=..,v1=..`). Mercado Pago firma con HMAC-SHA256 el
 * manifest `id:<data.id en minúsculas>;request-id:<x-request-id>;ts:<ts>;` y
 * quita del manifest cada parte que no llegó (un `request-id` vacío NO entra).
 */
function verifySignature(
  secret: string,
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null
): void {
  if (!secret) throw new WebhookAuthError("no_secret")
  if (!signatureHeader) throw new WebhookAuthError("no_signature")
  const parts = new Map<string, string>()
  for (const kv of signatureHeader.split(",")) {
    const i = kv.indexOf("=")
    if (i < 0) continue
    const k = kv.slice(0, i).trim()
    if (!parts.has(k)) parts.set(k, kv.slice(i + 1).trim())
  }
  const ts = parts.get("ts")
  const v1 = parts.get("v1")
  if (!ts || !/^\d+$/.test(ts) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) {
    throw new WebhookAuthError("bad_signature_format")
  }
  let manifest = ""
  if (dataId) manifest += `id:${dataId.toLowerCase()};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  const expected = createHmac("sha256", secret).update(manifest).digest()
  const given = Buffer.from(v1, "hex")
  if (given.length !== expected.length || !timingSafeEqual(expected, given)) {
    throw new WebhookAuthError("bad_signature")
  }
}

/** Eventos de un pago ya consultado a la API (nunca del cuerpo del webhook). */
function eventsFromPayment(p: MpPayment): PaymentEvent[] {
  const state = stateFromPayment(p)
  const pid = state.providerPaymentId
  const base = {
    kind: "payment" as const,
    provider: PROVIDER,
    paymentId: state.paymentId,
    providerPaymentId: pid,
  }
  const raw = String(p.status ?? "")
  const refunded = state.refundedMinor ?? 0

  if (state.status === "approved" || state.status === "refunded") {
    if (state.amountMinor === undefined || !state.currency) return []
    const out: PaymentEvent[] = [
      {
        ...base,
        type: "payment.approved",
        eventId: `payment:${pid}:approved:0`,
        amountMinor: state.amountMinor,
        currency: state.currency,
      },
    ]
    if (state.status === "refunded" || refunded > 0) {
      out.push({
        ...base,
        type: "payment.refunded",
        eventId: `payment:${pid}:${raw}:${refunded}`,
        refundedMinor: refunded,
        currency: state.currency,
      })
    }
    return out
  }
  return [
    {
      ...base,
      type: state.status === "pending" ? "payment.pending" : "payment.failed",
      eventId: `payment:${pid}:${raw}:0`,
      amountMinor: state.amountMinor,
      currency: state.currency,
    },
  ]
}

function stateFromPayment(p: MpPayment): ProviderPaymentState {
  const currency =
    typeof p.currency_id === "string" ? p.currency_id.toUpperCase() : undefined
  const amountMinor =
    currency && typeof p.transaction_amount === "number"
      ? majorToMinor(p.transaction_amount, currency)
      : undefined
  const refundedRaw =
    currency && typeof p.transaction_amount_refunded === "number"
      ? majorToMinor(p.transaction_amount_refunded, currency)
      : 0
  const raw = String(p.status ?? "")
  const fullyReversed = raw === "refunded" || raw === "charged_back"
  // Devuelto del todo sin cifra de reembolso: el total pagado.
  const refundedMinor =
    fullyReversed && refundedRaw === 0 ? (amountMinor ?? 0) : refundedRaw

  let status: ProviderPaymentState["status"]
  if (fullyReversed) status = "refunded"
  else if (raw === "approved")
    status = "approved" // con reembolso parcial sigue approved; lo dice refundedMinor
  else if (raw === "rejected" || raw === "cancelled") status = "failed"
  else status = "pending" // pending, in_process, authorized, in_mediation, desconocido

  return {
    status,
    providerPaymentId: String(p.id),
    paymentId:
      typeof p.external_reference === "string" && p.external_reference
        ? p.external_reference
        : undefined,
    amountMinor,
    currency,
    refundedMinor,
  }
}

/** Fábrica con la configuración ya leída (las pruebas la usan para el caso «sin secreto»). */
export function createMercadoPagoProvider(
  config: Config,
  deps: Deps = {}
): PaymentProvider {
  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis)

  /** Una llamada a la API. Un fallo lanza solo el estado: ni cuerpo, ni token, ni mensaje de red. */
  async function call(
    operation: string,
    path: string,
    init: { method?: string; body?: unknown; idempotent?: boolean } = {}
  ): Promise<unknown> {
    let res: Response
    try {
      res = await doFetch(`${API}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(init.idempotent ? { "X-Idempotency-Key": randomUUID() } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new ProviderApiError(PROVIDER, 0, operation)
    }
    if (!res.ok) throw new ProviderApiError(PROVIDER, res.status, operation)
    try {
      return await res.json()
    } catch {
      throw new ProviderApiError(PROVIDER, res.status, `${operation} (json)`)
    }
  }

  async function fetchPayment(id: string, operation: string) {
    if (!isNumericId(id)) throw new ProviderApiError(PROVIDER, 400, operation)
    const p = (await call(operation, `/v1/payments/${id}`)) as MpPayment
    if (!p || p.id === undefined || p.id === null) {
      throw new ProviderApiError(PROVIDER, 200, `${operation} (sin id)`)
    }
    return p
  }

  return {
    id: PROVIDER,

    async createCheckout(
      input: ProviderCheckoutInput
    ): Promise<ProviderCheckout> {
      const body = {
        items: [
          {
            id: input.orderId,
            title: input.description,
            quantity: 1,
            currency_id: input.currency,
            unit_price: minorToMajor(input.amountMinor, input.currency),
          },
        ],
        ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
        external_reference: input.paymentId,
        notification_url: input.notificationUrl,
        back_urls: {
          success: input.successUrl,
          failure: input.failureUrl,
          pending: input.pendingUrl,
        },
        auto_return: "approved",
        metadata: { order_id: input.orderId },
      }
      const res = (await call("createCheckout", "/checkout/preferences", {
        method: "POST",
        body,
        idempotent: true,
      })) as {
        id?: string
        init_point?: string
        sandbox_init_point?: string
      }
      const url =
        input.environment === "sandbox"
          ? res.sandbox_init_point
          : res.init_point
      if (!res.id || !url) {
        throw new ProviderApiError(
          PROVIDER,
          200,
          "createCheckout (respuesta sin id o url)"
        )
      }
      return { id: String(res.id), url }
    },

    async parseWebhook(req: Request, rawBody: string) {
      const query = new URL(req.url).searchParams
      let body: {
        type?: unknown
        data?: { id?: unknown }
      } = {}
      try {
        const parsed = JSON.parse(rawBody)
        if (parsed && typeof parsed === "object") body = parsed
      } catch {
        // cuerpo no JSON: la firma decide; abajo no habrá id y devuelve []
      }
      const dataId =
        query.get("data.id") ??
        (body.data?.id !== undefined && body.data?.id !== null
          ? String(body.data.id)
          : null)

      // 1. AUTENTICAR primero. Nada de lo de abajo corre si esto lanza.
      verifySignature(
        config.webhookSecret,
        req.headers.get("x-signature"),
        req.headers.get("x-request-id"),
        dataId
      )

      // 2. Solo pagos. Los demás topics (merchant_order, etc.) no importan.
      const type = query.get("type") ?? query.get("topic") ?? body.type
      if (type !== "payment" || !dataId) return []
      const id = dataId.toLowerCase()
      if (!isNumericId(id)) return []

      // 3. No se confía en el cuerpo: el estado sale de la API con el token.
      const payment = await fetchPayment(id, "parseWebhook")
      return eventsFromPayment(payment)
    },

    /**
     * Acepta un id de pago (numérico, p. ej. `?payment_id=` al volver del
     * checkout) o el id de la preferencia (`external_id` del pago de la app):
     * en ese caso se resuelve por `external_reference` y se toma el pago más
     * relevante (aprobado primero, luego el más reciente). Sin pagos aún →
     * `pending`.
     */
    async getPayment(ref: string): Promise<ProviderPaymentState> {
      if (isNumericId(ref)) {
        return stateFromPayment(await fetchPayment(ref, "getPayment"))
      }
      if (!/^[A-Za-z0-9-]{3,80}$/.test(ref)) {
        throw new ProviderApiError(PROVIDER, 400, "getPayment")
      }
      const pref = (await call(
        "getPayment (preferencia)",
        `/checkout/preferences/${ref}`
      )) as { external_reference?: string }
      const ext = pref.external_reference
      if (!ext) {
        throw new ProviderApiError(PROVIDER, 200, "getPayment (sin referencia)")
      }
      const found = (await call(
        "getPayment (búsqueda)",
        `/v1/payments/search?external_reference=${encodeURIComponent(ext)}&sort=date_created&criteria=desc`
      )) as { results?: MpPayment[] }
      const results = (found.results ?? []).filter(
        (p) => p.external_reference === ext && p.id !== undefined
      )
      if (results.length === 0) {
        return { status: "pending", providerPaymentId: ref, paymentId: ext }
      }
      const best = results.find((p) => p.status === "approved") ?? results[0]
      return stateFromPayment(best)
    },

    async refund(providerPaymentId: string, amountMinor?: number) {
      const payment = await fetchPayment(providerPaymentId, "refund")
      const currency = String(payment.currency_id ?? "")
      const body =
        amountMinor === undefined
          ? undefined
          : { amount: minorToMajor(amountMinor, currency) }
      if (amountMinor !== undefined && !currency) {
        throw new ProviderApiError(PROVIDER, 200, "refund (sin moneda)")
      }
      await call("refund", `/v1/payments/${providerPaymentId}/refunds`, {
        method: "POST",
        body: body ?? {},
        idempotent: true,
      })
    },
  }
}

export function createProvider(
  env: Env = process.env,
  deps: Deps = {}
): PaymentProvider | null {
  const keys = readProviderEnv(
    PROVIDER,
    ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"] as const,
    env
  )
  if (!keys) return null
  return createMercadoPagoProvider(
    {
      accessToken: keys.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: keys.MERCADOPAGO_WEBHOOK_SECRET,
    },
    deps
  )
}
