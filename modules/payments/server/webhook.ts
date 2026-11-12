import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  ProviderNotConfiguredError,
  WebhookAuthError,
  type PaymentProvider,
} from "../contracts/types"

import { applyEvents } from "./apply"
import { logPayment } from "./log"

const MAX_BODY_BYTES = 256 * 1024

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  })

/**
 * El camino completo de una notificación. El orden es la garantía:
 *
 *   1. proveedor desconocido o sin configurar → 404 / 401, nada escrito
 *   2. cuerpo demasiado grande               → 413, nada escrito
 *   3. `parseWebhook` autentica (firma, o consulta a la API del proveedor)
 *      — si no puede, 401 y NADA escrito (PAY-3); sin secreto, también rechaza
 *   4. solo entonces se escribe, evento por evento, idempotente (PAY-2)
 *
 * Un error al consultar al proveedor o a la base responde 500/502: no se
 * escribió nada y el proveedor reintenta. Nunca se registra el cuerpo, las
 * cabeceras ni el mensaje de un error del proveedor (PAY-4).
 */
export async function handleWebhook(
  loadProvider: () => Promise<PaymentProvider | null>,
  req: Request,
  db: Kysely<Database>
): Promise<Response> {
  let provider: PaymentProvider | null
  try {
    provider = await loadProvider()
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) {
      logPayment({
        at: "webhook",
        outcome: "provider_misconfigured",
        status: 401,
      })
      return json(401, { error: "unauthorized" })
    }
    throw e
  }
  if (!provider) return json(404, { error: "not_found" })

  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_BODY_BYTES) return json(413, { error: "too_large" })
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: "too_large" })

  let events
  try {
    events = await provider.parseWebhook(req, rawBody)
  } catch (e) {
    if (e instanceof WebhookAuthError) {
      logPayment({
        at: "webhook",
        provider: provider.id,
        outcome: `rejected:${e.reason}`,
        status: 401,
      })
      return json(401, { error: "unauthorized" })
    }
    logPayment({
      at: "webhook",
      provider: provider.id,
      outcome: "provider_error",
      status: 502,
    })
    return json(502, { error: "upstream" })
  }

  try {
    const results = await applyEvents(db, events)
    for (const r of results) {
      logPayment({
        at: "webhook",
        provider: provider.id,
        eventId: r.eventId,
        outcome: r.outcome,
      })
    }
    return json(200, { ok: true, results })
  } catch {
    logPayment({
      at: "webhook",
      provider: provider.id,
      outcome: "apply_failed",
      status: 500,
    })
    return json(500, { error: "retry" })
  }
}
