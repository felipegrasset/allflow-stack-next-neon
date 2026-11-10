import type { ModulePermissions } from "../contract/types"

/**
 * `read`: ver y marcar como leídas las notificaciones PROPIAS (todos los roles).
 * `manage`: reservado para v0.2 (ver las de otros / borrar); v0.1 no lo comprueba.
 */
export const permissions = {
  statement: { notifications: ["read", "manage"] },
  grants: { member: { notifications: ["read"] } },
} as const satisfies ModulePermissions
