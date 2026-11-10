/**
 * Lo único que otro módulo puede importar de `notifications`:
 *
 *   import { notify } from "@/modules/notifications/contracts"
 *   await notify({ userId, title: "Tu informe está listo", href: "/reports/42" })
 *
 * `notify` valida (zod) y lanza si la entrada es inválida; es una función de
 * servidor: no la llames desde un componente de cliente.
 */
export { notify } from "../server/notify"
export {
  NOTIFICATION_KINDS,
  notifyInputSchema,
  type Notification,
  type NotificationKind,
  type NotifyInput,
  type NotifyResult,
} from "./input"
