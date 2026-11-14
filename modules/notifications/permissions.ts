import type { ModulePermissions } from "../contract/types"

/**
 * `read`: see and mark as read one's OWN notifications (every role).
 *
 * Declared so the resource shows up in the roles (and in the role editor), but
 * the module does not call `hasPermission`: what actually protects the data is
 * the session guard plus every query and update being scoped to
 * `session.user.id`. There is no permission over other people's notifications
 * because no screen or action reads or touches them.
 */
export const permissions = {
  statement: { notifications: ["read"] },
  grants: { member: { notifications: ["read"] } },
} as const satisfies ModulePermissions
