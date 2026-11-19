/**
 * Lo único que otro módulo puede importar de `push` (todo de servidor):
 *
 *   import { notifyWithPush, sendPush } from "@/modules/push/contracts"
 *
 *   // El aviso de notifications + un push con lo mismo (solo si el aviso es nuevo):
 *   await notifyWithPush({ userId, title: "Tu pedido salió", href: "/orders/42", id: `order-shipped-42` })
 *
 *   // Solo el push, a todos los dispositivos de la persona:
 *   await sendPush(userId, { title: "Recordatorio", body: "Mañana a las 10:00", href: "/bookings" })
 *   // → { configured, devices, sent, removed, failed }
 *
 * Sin VAPID_* configuradas no se envía nada (`configured: false`) y nada falla.
 */
export {
  isPushConfigured,
  notifyWithPush,
  sendPush,
  vapidPublicKey,
  type NotifyWithPushResult,
  type SendPushResult,
} from "../server/push"
export type { PushPayload, SendOptions } from "../server/payload"
export { generateVapidKeys } from "../server/crypto/webpush"
