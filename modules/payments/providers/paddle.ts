import { createHmac, timingSafeEqual } from "node:crypto"

import {
  ProviderApiError,
  WebhookAuthError,
  type PaymentEvent,
  type PaymentProvider,
  type ProviderCheckout,
  type ProviderCheckoutInput,
  type ProviderPaymentState,
  type SubscriptionInput,
} from "../contracts/types"
import {
  paymentsEnvironment,
  readProviderEnv,
  type Env,
} from "../server/config"

/**
 * Paddle Billing (API v2).
 *
 * POLÍTICA: Paddle prohíbe bienes físicos, servicios humanos sin software y
 * marketplaces. Este adaptador es SOLO para apps que venden software o
 * contenido digital propio, cada cliente con SU cuenta Paddle aprobada.
 * Nunca es el proveedor por defecto (server/registry.ts) y jamás en el
 * arquetipo `ecommerce`: solo se usa si se pide por nombre.
 *
 * Montos: Paddle usa la unidad menor como string ("1500" = USD 15,00;
 * JPY "1500" = 1500 yenes), igual que el contrato. No se convierte nada.
 *
 * Reembolsos: Paddle solo reembolsa transacciones `completed`. En producción
 * el ajuste suele quedar `pending_approval` hasta que Paddle lo revisa; en
 * sandbox se aprueba solo (cada ~10 min). Por eso `refund()` no cambia nada:
 * el estado cambia con el webhook `adjustment.*` ya `approved`.
 *
 * Variables: PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET.
 */

const PROVIDER = "paddle" as const
/** Ventana contra replay. El SDK de Paddle usa 5 s; aquí 5 min por desfase de reloj (ajustable vía deps.toleranceSeconds). */
const DEFAULT_TOLERANCE_SECONDS = 300
const REQUEST_TIMEOUT_MS = 15_000
const MAX_ADJUSTMENT_PAGES = 10
/** Categoría de impuestos para software / contenido digital propio. */
const TAX_CATEGORY = "standard"

type Deps = {
  fetch?: typeof fetch
  /** Reloj en ms (solo pruebas). */
  now?: () => number
  toleranceSeconds?: number
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {}
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v : undefined

/** Monto de Paddle (string de entero, unidad menor) → entero. Cualquier otra forma se rechaza. */
function minor(v: unknown): number {
  const s = typeof v === "number" ? String(v) : v
  if (typeof s !== "string" || !/^\d{1,15}$/.test(s))
    throw new Error("paddle: monto inválido")
  return Number(s)
}

export function createProvider(
  env: Env = process.env,
  deps: Deps = {}
): PaymentProvider | null {
  const cfg = readProviderEnv(
    PROVIDER,
    ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"] as const,
    env
  )
  if (!cfg) return null
  const doFetch = deps.fetch ?? fetch
  const now = deps.now ?? Date.now
  const tolerance = deps.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const base =
    paymentsEnvironment(env) === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com"

  /** Nunca lanza con cuerpo ni llave: solo estado. */
  async function api(
    op: string,
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<Json> {
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${cfg!.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new ProviderApiError(PROVIDER, 0, op)
    }
    if (!res.ok) throw new ProviderApiError(PROVIDER, res.status, op)
    try {
      return obj(await res.json())
    } catch {
      throw new ProviderApiError(PROVIDER, res.status, op)
    }
  }

  async function postTransaction(
    op: string,
    body: unknown
  ): Promise<ProviderCheckout> {
    const data = obj((await api(op, "POST", "/transactions", body)).data)
    const id = str(data.id)
    const url = str(obj(data.checkout).url)
    // Sin payment link por defecto aprobado en el panel, Paddle no devuelve URL.
    if (!id || !url)
      throw new Error("paddle: la transacción no devolvió checkout.url")
    return { id, url }
  }

  /** Suma los reembolsos aprobados de una transacción (el evento solo trae el ajuste individual). */
  async function approvedRefundsTotal(txnId: string): Promise<number> {
    let total = 0
    let path = `/adjustments?transaction_id=${encodeURIComponent(txnId)}&action=refund&status=approved&per_page=50`
    for (let page = 0; page < MAX_ADJUSTMENT_PAGES; page++) {
      const res = await api("listAdjustments", "GET", path)
      const rows = Array.isArray(res.data) ? res.data : []
      for (const r of rows) total += minor(obj(obj(r).totals).total)
      const pag = obj(obj(res.meta).pagination)
      const next = str(pag.next)
      if (pag.has_more !== true || !next) return total
      const after = new URL(next).searchParams.get("after")
      if (!after) return total
      path = `/adjustments?transaction_id=${encodeURIComponent(txnId)}&action=refund&status=approved&per_page=50&after=${encodeURIComponent(after)}`
    }
    return total
  }

  /** ¿La firma es válida para este cuerpo? Acepta varios `h1` (rotación de secreto). */
  function verify(header: string | null, rawBody: string): void {
    if (!header) throw new WebhookAuthError("missing_signature")
    let ts: string | undefined
    const h1s: string[] = []
    for (const part of header.split(";")) {
      const i = part.indexOf("=")
      if (i < 0) continue
      const k = part.slice(0, i).trim()
      const v = part.slice(i + 1).trim()
      if (k === "ts") ts = v
      else if (k === "h1") h1s.push(v)
    }
    if (!ts || !/^\d{1,12}$/.test(ts) || h1s.length === 0)
      throw new WebhookAuthError("malformed_signature")
    const expected = createHmac("sha256", cfg!.PADDLE_WEBHOOK_SECRET)
      .update(`${ts}:${rawBody}`)
      .digest()
    // Se evalúan todos (sin cortocircuito) para no filtrar cuál coincidió.
    let ok = false
    for (const h of h1s) {
      if (!/^[0-9a-f]{64}$/i.test(h)) continue
      if (timingSafeEqual(expected, Buffer.from(h, "hex"))) ok = true
    }
    if (!ok) throw new WebhookAuthError("bad_signature")
    if (Math.abs(now() / 1000 - Number(ts)) > tolerance)
      throw new WebhookAuthError("stale_timestamp")
  }

  return {
    id: PROVIDER,

    async createCheckout(input: ProviderCheckoutInput) {
      // Ítem no-catálogo: el monto sale de NUESTRA orden. `payment_id` viaja en
      // custom_data y vuelve en el webhook. (`payerEmail` no se envía: la API pide
      // customer_id; el checkout alojado pide el correo.) Las URLs de retorno se
      // configuran en el payment link por defecto del panel de Paddle.
      return postTransaction("createCheckout", {
        currency_code: input.currency.toUpperCase(),
        items: [
          {
            quantity: 1,
            price: {
              description: input.description,
              unit_price: {
                amount: String(input.amountMinor),
                currency_code: input.currency.toUpperCase(),
              },
              product: { name: input.description, tax_category: TAX_CATEGORY },
            },
          },
        ],
        custom_data: { payment_id: input.paymentId, order_id: input.orderId },
      })
    },

    async parseWebhook(req: Request, rawBody: string): Promise<PaymentEvent[]> {
      // 1) Autenticar ANTES de mirar el contenido.
      verify(req.headers.get("paddle-signature"), rawBody)

      let payload: Json
      try {
        payload = obj(JSON.parse(rawBody))
      } catch {
        return []
      }
      const eventId = str(payload.event_id)
      const type = str(payload.event_type)
      const data = obj(payload.data)
      if (!eventId || !type) return []
      const custom = obj(data.custom_data)
      const paymentId = str(custom.payment_id)
      const head = { provider: PROVIDER, eventId } as const

      switch (type) {
        case "transaction.completed": {
          const txn = str(data.id)
          const currency = str(data.currency_code)
          if (!txn || !currency) return []
          return [
            {
              ...head,
              kind: "payment",
              type: "payment.approved",
              paymentId,
              providerPaymentId: txn,
              amountMinor: minor(obj(obj(data.details).totals).grand_total),
              currency,
            },
          ]
        }
        case "transaction.payment_failed":
        case "transaction.past_due":
        case "transaction.billed": {
          const txn = str(data.id)
          if (!txn) return []
          return [
            {
              ...head,
              kind: "payment",
              type:
                type === "transaction.payment_failed"
                  ? "payment.failed"
                  : "payment.pending",
              paymentId,
              providerPaymentId: txn,
            },
          ]
        }
        case "adjustment.created":
        case "adjustment.updated": {
          // Solo reembolsos ya aprobados cuentan; pending_approval/rejected no.
          if (data.action !== "refund" || data.status !== "approved") return []
          const txn = str(data.transaction_id)
          if (!txn) return []
          const own = minor(obj(data.totals).total)
          // El evento trae solo ESTE ajuste: el acumulado sale de la API (con la llave).
          let total = await approvedRefundsTotal(txn)
          // Si la lista aún no refleja este ajuste, no se pierde: el mínimo es el propio.
          total = Math.max(total, own)
          return [
            {
              ...head,
              kind: "payment",
              type: "payment.refunded",
              providerPaymentId: txn,
              refundedMinor: total,
              currency: str(data.currency_code),
            },
          ]
        }
        case "subscription.created":
        case "subscription.activated":
        case "subscription.past_due":
        case "subscription.canceled": {
          const externalId = str(data.id)
          if (!externalId) return []
          const price = obj(
            obj(Array.isArray(data.items) ? data.items[0] : null).price
          )
          const periodEnd =
            str(obj(data.current_billing_period).ends_at) ??
            str(data.next_billed_at)
          const end = periodEnd ? new Date(periodEnd) : undefined
          return [
            {
              ...head,
              kind: "subscription",
              type:
                type === "subscription.past_due"
                  ? "subscription.past_due"
                  : type === "subscription.canceled"
                    ? "subscription.canceled"
                    : "subscription.active",
              externalId,
              subscriberRef: str(custom.subscriber_ref),
              planRef: str(price.id),
              currentPeriodEnd: end && !Number.isNaN(+end) ? end : undefined,
            },
          ]
        }
        default:
          return []
      }
    },

    async getPayment(txnId: string): Promise<ProviderPaymentState> {
      const data = obj(
        (
          await api(
            "getPayment",
            "GET",
            `/transactions/${encodeURIComponent(txnId)}`
          )
        ).data
      )
      const totals = obj(obj(data.details).totals)
      const amountMinor =
        totals.grand_total !== undefined ? minor(totals.grand_total) : undefined
      const state: ProviderPaymentState = {
        status: "pending",
        providerPaymentId: str(data.id) ?? txnId,
        paymentId: str(obj(data.custom_data).payment_id),
        amountMinor,
        currency: str(data.currency_code),
      }
      switch (data.status) {
        case "completed": {
          const refunded = await approvedRefundsTotal(txnId)
          state.refundedMinor = refunded
          state.status =
            amountMinor !== undefined && refunded >= amountMinor && refunded > 0
              ? "refunded"
              : "approved"
          break
        }
        case "canceled":
          state.status = "failed"
          break
        default:
          state.status = "pending"
      }
      return state
    },

    async refund(txnId: string, amountMinor?: number): Promise<void> {
      const txn = obj(
        (
          await api(
            "refund",
            "GET",
            `/transactions/${encodeURIComponent(txnId)}`
          )
        ).data
      )
      if (txn.status !== "completed")
        throw new Error("paddle: solo se reembolsan transacciones completed")
      if (amountMinor === undefined) {
        await api("refund", "POST", "/adjustments", {
          action: "refund",
          type: "full",
          transaction_id: txnId,
          reason: "requested_by_customer",
        })
        return
      }
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
        throw new Error("paddle: monto de reembolso inválido")
      const items = Array.isArray(txn.items) ? txn.items : []
      const itemId = str(obj(items[0]).id)
      // Un reembolso parcial se reparte por ítem: las transacciones de este
      // adaptador tienen uno solo. Con varios, se rechaza en vez de adivinar.
      if (items.length !== 1 || !itemId)
        throw new Error(
          "paddle: reembolso parcial solo en transacciones de un ítem"
        )
      await api("refund", "POST", "/adjustments", {
        action: "refund",
        type: "partial",
        transaction_id: txnId,
        reason: "requested_by_customer",
        items: [
          { item_id: itemId, type: "partial", amount: String(amountMinor) },
        ],
      })
    },

    async createSubscription(
      input: SubscriptionInput & { notificationUrl: string; successUrl: string }
    ) {
      // Paddle crea la suscripción al pagar una transacción con precio recurrente.
      return postTransaction("createSubscription", {
        items: [{ price_id: input.planRef, quantity: 1 }],
        custom_data: { subscriber_ref: input.subscriberRef },
      })
    },

    async cancelSubscription(externalId: string): Promise<void> {
      await api(
        "cancelSubscription",
        "POST",
        `/subscriptions/${encodeURIComponent(externalId)}/cancel`,
        { effective_from: "next_billing_period" }
      )
    },
  }
}
