/**
 * Lo único que otro módulo (o la app) puede importar de `whatsapp`. Todo es de
 * servidor.
 *
 *   import { recordOptIn, sendWhatsApp } from "@/modules/whatsapp/contracts"
 *
 *   // 1. En la server action del formulario donde la persona marcó la casilla:
 *   await recordOptIn({ phone: "+56912345678", source: "form", userId,
 *     evidence: "registro v1: casilla «Acepto recibir avisos por WhatsApp»" })
 *
 *   // 2. Al enviar (un cron, un aviso). Fuera de 24 h, solo plantillas:
 *   const r = await sendWhatsApp({ to: "+56912345678",
 *     template: { name: "recordatorio_cita", lang: "es", params: ["Ana", "martes 10:00"] },
 *     idempotencyKey: `cita-${cita.id}-24h` })
 *   if (!r.ok) …  // r.reason: no_optin | opted_out | outside_window | not_configured | provider_error …
 *
 * `sendWhatsApp` SIEMPRE comprueba consentimiento, baja y ventana de 24 h, pero
 * NO comprueba sesión ni permiso: si lo dispara una persona desde una pantalla,
 * tu server action llama antes a `canSendWhatsApp()`.
 */
import type {
  Consent,
  SendInput,
  SendResult,
  WhatsAppMessage,
} from "./types"

import * as consent from "../server/consent"
import { normalizePhone } from "../server/phone"
import { sendDeps, store } from "../server/runtime"
import * as send from "../server/send"

/** Envía un texto (dentro de 24 h) o una plantilla. Nunca lanza por una regla: devuelve `{ ok: false, reason }`. */
export const sendWhatsApp = (input: SendInput): Promise<SendResult> =>
  send.sendWhatsApp(sendDeps(), input)

/**
 * Registra el consentimiento. `source: "form"` (la persona marcó la casilla)
 * o `"api"` (código con su propia evidencia). NO revierte una baja:
 * devuelve `{ ok: false, reason: "opted_out" }`; solo la persona vuelve
 * escribiendo ALTA o START al número.
 */
export const recordOptIn = (input: consent.OptInInput) =>
  consent.recordOptIn(store(), input)

/** Registra la baja. Siempre gana, venga de donde venga. */
export const recordOptOut = (input: consent.OptOutInput) =>
  consent.recordOptOut(store(), input)

/** El consentimiento de un número (`status: "none"` si no hay registro o el número no es válido). */
export async function getConsent(phone: string): Promise<Consent> {
  const p = normalizePhone(phone)
  if (!p)
    return { phone, status: "none", userId: null, source: null, optedInAt: null, optedOutAt: null }
  return store().getConsent(p)
}

/** Mensajes, del más nuevo al más viejo (hasta 200). Contienen datos personales: no los expongas sin permiso. */
export async function listMessages(
  q: { phone?: string; limit?: number } = {}
): Promise<WhatsAppMessage[]> {
  const phone = q.phone ? normalizePhone(q.phone) : undefined
  if (phone === null) return []
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200)
  return store().listMessages({ phone, limit })
}

/**
 * Borra todo lo de un número (mensajes y consentimiento): derecho de
 * supresión. Ojo: sin fila de consentimiento tampoco queda la baja; si la
 * persona pidió no recibir más, registra `recordOptOut` después.
 */
export async function forgetPhone(phone: string): Promise<number> {
  const p = normalizePhone(phone)
  if (!p) return 0
  return store().forget(p)
}

export { canSendWhatsApp } from "../server/authz"
export { maskPhone, normalizePhone } from "../server/phone"
export { withinServiceWindow } from "../server/window"
export type { OptInInput, OptOutInput, ConsentResult } from "../server/consent"
export * from "./types"
