import { createHmac } from "node:crypto"

import { majorToMinor, minorToMajor } from "../contracts/money"
import {
  ProviderApiError,
  WebhookAuthError,
  type PaymentEvent,
  type PaymentProvider,
  type ProviderCheckout,
  type ProviderCheckoutInput,
  type ProviderPaymentState,
} from "../contracts/types"
import {
  paymentsEnvironment,
  readProviderEnv,
  webhookUrl,
  type Env,
} from "../server/config"

/**
 * Flow (flow.cl, Chile). Docs: https://developers.flow.cl/api
 *
 * Mismo código con la cuenta de Fulvia y con las llaves del cliente (BYOK):
 * solo cambian `FLOW_API_KEY` y `FLOW_SECRET_KEY`.
 *
 * Verificado contra la documentación oficial (09/11/2026):
 *  - Firma: parámetros (menos `s`) ordenados por nombre, `nombre+valor` sin
 *    separadores, HMAC-SHA256 con la SecretKey, hex, enviado como `s`.
 *  - `payment/create` (POST form) → {url, token, flowOrder}; se paga en `url?token=`.
 *  - `payment/getStatus` (GET, `token`), `payment/getStatusByFlowOrder` (GET, `flowOrder`).
 *  - `status` del pago: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada
 *    (https://developers.flow.cl/en/docs/tutorial-basics/status).
 *  - La notificación (`urlConfirmation`) es un POST form con UN solo campo: `token`.
 *  - `refund/create` (POST form): apiKey, refundCommerceOrder, receiverEmail, amount,
 *    urlCallBack, flowTrxId | commerceTrxId, s. Costo: $202 + IVA por reembolso.
 *  - Errores: 400 error de API, 401 error de negocio (el cuerpo no tiene esquema documentado).
 *
 * NO verificado (no aparece en la documentación leída): los valores de `status`
 * de `refund/getStatus`, si un reembolso parcial es aceptado, y qué devuelve el
 * pago aprobado tras reembolsarlo. Por eso el reembolso NO se refleja solo
 * (ver `refund`).
 *
 * Mapeo token ↔ flowOrder: Flow identifica un pago de dos maneras. El `token`
 * (texto de ~40 caracteres) lo devuelve `payment/create` y es el `external_id`
 * del pago de la app; sirve para `getStatus`. El `flowOrder` (número) es el
 * número de orden de Flow, el que pide `refund/create` (`flowTrxId`); el
 * núcleo lo guarda como `provider_payment_id` cuando llega el primer evento
 * aprobado. `getPayment` acepta cualquiera de los dos (un flowOrder es solo
 * dígitos y corto; un token no) y siempre devuelve `providerPaymentId = flowOrder`.
 *
 * Suscripciones (planes, clientes, `subscription/create`): NO implementadas.
 * Quedan fuera hasta tener el pago único probado en un sandbox real; este
 * adaptador no define `createSubscription` ni `cancelSubscription`.
 */

const PROVIDER = "flow" as const
const TIMEOUT_MS = 15_000
const SUBJECT_MAX = 255

type Params = Record<string, string | number | undefined>

/**
 * Firma de Flow: HMAC-SHA256 (hex) sobre `nombre+valor` de cada parámetro,
 * ordenados alfabéticamente por nombre, sin incluir `s`. Pura y determinista.
 */
export function sign(params: Params, secretKey: string): string {
  const toSign = Object.keys(params)
    .filter((k) => k !== "s" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}${String(params[k])}`)
    .join("")
  return createHmac("sha256", secretKey).update(toSign).digest("hex")
}

type FlowStatusBody = {
  flowOrder?: unknown
  commerceOrder?: unknown
  status?: unknown
  currency?: unknown
  amount?: unknown
  payer?: unknown
}

type Normalized = {
  status: ProviderPaymentState["status"]
  flowStatus: 1 | 2 | 3 | 4
  flowOrder: string
  paymentId: string
  amountMinor: number
  currency: string
  payer?: string
}

const STATUS_MAP: Record<number, ProviderPaymentState["status"]> = {
  1: "pending",
  2: "approved",
  3: "failed",
  4: "failed",
}

export function createProvider(
  env: Env = process.env,
  deps: { fetch?: typeof fetch } = {}
): PaymentProvider | null {
  const keys = readProviderEnv(
    "flow",
    ["FLOW_API_KEY", "FLOW_SECRET_KEY"] as const,
    env
  )
  if (!keys) return null
  const { FLOW_API_KEY: apiKey, FLOW_SECRET_KEY: secretKey } = keys
  const environment = paymentsEnvironment(env)
  const base =
    environment === "sandbox"
      ? "https://sandbox.flow.cl/api"
      : "https://www.flow.cl/api"

  /** Firma y llama. Nunca envía la secretKey ni deja el cuerpo de la respuesta en un error. */
  async function call(
    method: "GET" | "POST",
    path: string,
    params: Params,
    operation: string
  ): Promise<Record<string, unknown>> {
    const signed: Record<string, string> = {}
    const withKey: Params = { ...params, apiKey }
    for (const [k, v] of Object.entries(withKey)) {
      if (v !== undefined) signed[k] = String(v)
    }
    signed.s = sign(signed, secretKey)
    const qs = new URLSearchParams(signed).toString()

    let res: Response
    try {
      res = await (deps.fetch ?? fetch)(
        method === "GET" ? `${base}${path}?${qs}` : `${base}${path}`,
        {
          method,
          ...(method === "POST"
            ? {
                headers: {
                  "content-type": "application/x-www-form-urlencoded",
                },
                body: qs,
              }
            : {}),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      )
    } catch {
      // Error de red: el mensaje original podría traer la URL con la firma.
      throw new ProviderApiError(PROVIDER, 0, operation)
    }
    if (!res.ok) throw new ProviderApiError(PROVIDER, res.status, operation)
    try {
      const body: unknown = await res.json()
      if (body && typeof body === "object")
        return body as Record<string, unknown>
    } catch {
      /* cae abajo */
    }
    throw new ProviderApiError(PROVIDER, res.status, operation)
  }

  function normalize(body: FlowStatusBody, operation: string): Normalized {
    const flowStatus = Number(body.status)
    const status = STATUS_MAP[flowStatus]
    const flowOrder = String(body.flowOrder ?? "")
    const paymentId = String(body.commerceOrder ?? "")
    const amount = Number(body.amount)
    const currency =
      typeof body.currency === "string" && body.currency
        ? body.currency.toUpperCase()
        : "CLP"
    if (
      !status ||
      !/^\d{1,20}$/.test(flowOrder) ||
      !paymentId ||
      !Number.isFinite(amount)
    ) {
      // Respuesta que no podemos interpretar: nunca se adivina el estado de un pago.
      throw new ProviderApiError(PROVIDER, 200, operation)
    }
    return {
      status,
      flowStatus: flowStatus as 1 | 2 | 3 | 4,
      flowOrder,
      paymentId,
      amountMinor: majorToMinor(amount, currency),
      currency,
      payer: typeof body.payer === "string" ? body.payer : undefined,
    }
  }

  const getByToken = async (token: string, operation: string) =>
    normalize(
      (await call(
        "GET",
        "/payment/getStatus",
        { token },
        operation
      )) as FlowStatusBody,
      operation
    )

  const getByFlowOrder = async (flowOrder: string, operation: string) =>
    normalize(
      (await call(
        "GET",
        "/payment/getStatusByFlowOrder",
        { flowOrder },
        operation
      )) as FlowStatusBody,
      operation
    )

  /** Un flowOrder es numérico y corto; un token de Flow es una cadena larga. */
  const isFlowOrder = (ref: string) => /^\d{1,15}$/.test(ref)

  return {
    id: PROVIDER,

    async createCheckout(
      input: ProviderCheckoutInput
    ): Promise<ProviderCheckout> {
      if (input.environment !== environment) {
        throw new Error(
          "El entorno del pago no coincide con el de las llaves de Flow"
        )
      }
      if (!input.payerEmail) {
        throw new Error("Flow exige el email del pagador (payerEmail)")
      }
      const body = await call(
        "POST",
        "/payment/create",
        {
          commerceOrder: input.paymentId,
          subject: input.description.slice(0, SUBJECT_MAX),
          currency: input.currency,
          amount: minorToMajor(input.amountMinor, input.currency),
          email: input.payerEmail,
          urlConfirmation: input.notificationUrl,
          urlReturn: input.successUrl,
        },
        "createCheckout"
      )
      const { url, token } = body
      if (typeof url !== "string" || typeof token !== "string" || !token) {
        throw new ProviderApiError(PROVIDER, 200, "createCheckout")
      }
      return { id: token, url: `${url}?token=${encodeURIComponent(token)}` }
    },

    async parseWebhook(_req, rawBody): Promise<PaymentEvent[]> {
      // Lo único que se lee del cuerpo es el token, y solo para PREGUNTARLE a Flow.
      const token = new URLSearchParams(rawBody).get("token")?.trim()
      if (!token || !/^[A-Za-z0-9_-]{1,128}$/.test(token)) {
        throw new WebhookAuthError("sin_token")
      }
      let st: Normalized
      try {
        st = await getByToken(token, "parseWebhook")
      } catch (e) {
        // 400/401: Flow no reconoce el token como un pago nuestro.
        if (
          e instanceof ProviderApiError &&
          [400, 401, 404].includes(e.status)
        ) {
          // El aviso de un reembolso (urlCallBack) también trae solo un token:
          // se autentica con refund/getStatus y no cambia nada (ver `refund`).
          try {
            await call("GET", "/refund/getStatus", { token }, "parseWebhook")
            return []
          } catch {
            throw new WebhookAuthError("token_desconocido")
          }
        }
        throw e // 5xx o red: no se escribió nada, Flow reintenta
      }
      const common = {
        kind: "payment" as const,
        provider: PROVIDER,
        eventId: `flow:${st.flowOrder}:${st.flowStatus}`,
        paymentId: st.paymentId,
        providerPaymentId: st.flowOrder,
      }
      if (st.status === "approved") {
        return [
          {
            ...common,
            type: "payment.approved",
            amountMinor: st.amountMinor,
            currency: st.currency,
          },
        ]
      }
      return [
        {
          ...common,
          type: st.status === "pending" ? "payment.pending" : "payment.failed",
          amountMinor: st.amountMinor,
          currency: st.currency,
        },
      ]
    },

    async getPayment(ref: string): Promise<ProviderPaymentState> {
      const st = isFlowOrder(ref)
        ? await getByFlowOrder(ref, "getPayment")
        : await getByToken(ref, "getPayment")
      return {
        status: st.status,
        providerPaymentId: st.flowOrder,
        paymentId: st.paymentId,
        amountMinor: st.amountMinor,
        currency: st.currency,
      }
    },

    /**
     * Reembolso (`refund/create`). Cuesta $202 + IVA cada uno (tarifas de Flow
     * al 08/11/2026). `providerPaymentId` es el flowOrder. Flow pide el email
     * del pagador: se lee del propio pago (`getStatusByFlowOrder`), no de la
     * app. El `refundCommerceOrder` es determinista (flowOrder + monto), así
     * un reintento de la app NO duplica el reembolso: Flow rechaza el repetido
     * (efecto: dos reembolsos parciales del mismo monto sobre un pago no son
     * posibles; el segundo debe pedirse por otro monto).
     *
     * Reflejo en `syncPayment`: NO es automático. Flow confirma el reembolso de
     * forma asíncrona (avisa a `urlCallBack` con un token, que `parseWebhook`
     * autentica con `refund/getStatus` y descarta), y `getStatus` del pago no
     * informa lo reembolsado. Hasta que se verifique en sandbox qué devuelve
     * Flow, el estado del pago en la app sigue `approved` tras reembolsar:
     * hay que conciliarlo a mano (hueco documentado, no resuelto aquí).
     */
    async refund(providerPaymentId: string, amountMinor?: number) {
      if (!isFlowOrder(providerPaymentId)) {
        throw new Error("Flow reembolsa por flowOrder (número), no por token")
      }
      const pay = await getByFlowOrder(providerPaymentId, "refund")
      if (pay.flowStatus !== 2) {
        throw new Error("Solo se reembolsa un pago pagado en Flow")
      }
      if (!pay.payer) {
        throw new Error("Flow no informó el email del pagador para reembolsar")
      }
      const minor = amountMinor ?? pay.amountMinor
      if (minor > pay.amountMinor)
        throw new Error("Monto de reembolso inválido")
      const amount = minorToMajor(minor, pay.currency)
      await call(
        "POST",
        "/refund/create",
        {
          refundCommerceOrder: `rf-${pay.flowOrder}-${amount}`,
          receiverEmail: pay.payer,
          amount,
          urlCallBack: webhookUrl(PROVIDER, env),
          flowTrxId: pay.flowOrder,
        },
        "refund"
      )
    },
  }
}
