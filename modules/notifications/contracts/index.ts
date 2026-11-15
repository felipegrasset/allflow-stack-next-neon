/**
 * Lo único que otro módulo puede importar de `notifications`:
 *
 *   import { notify } from "@/modules/notifications/contracts"
 *   await notify({ userId, title: "Tu informe está listo", href: "/reports/42" })
 *
 * `notify` valida (zod) y lanza si la entrada es inválida; es una función de
 * servidor: no la llames desde un componente de cliente.
 *
 * Avisar a todos los que tienen un permiso (roles estáticos y dinámicos):
 *
 *   import { notifyPermission } from "@/modules/notifications/contracts"
 *   await notifyPermission(
 *     { resource: "ticket", action: "manage" },
 *     { title: "Nuevo ticket", href: "/admin/tickets", id: `ticket-${ticketId}` },
 *     { excludeUserIds: [authorId] },
 *   )
 *   // → { userIds, truncated, created, failed }   (tope 100 por defecto, 500 máx.)
 *
 * `listUsersWithPermission({ resource, action }, opts?)` devuelve solo los ids.
 */
export { notify } from "../server/notify"
export {
  listUsersWithPermission,
  notifyPermission,
  RECIPIENTS_DEFAULT_LIMIT,
  RECIPIENTS_MAX_LIMIT,
  type NotifyPermissionPayload,
  type NotifyPermissionResult,
  type PermissionTarget,
  type RecipientsOptions,
  type RecipientsResult,
} from "../server/by-permission"
export {
  NOTIFICATION_KINDS,
  notifyInputSchema,
  type Notification,
  type NotificationKind,
  type NotifyInput,
  type NotifyResult,
} from "./input"
