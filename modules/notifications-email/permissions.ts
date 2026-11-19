import type { ModulePermissions } from "../contract/types"

/**
 * `notificationEmail:manage` — see and change YOUR OWN email preference.
 *
 * owner, admin and member all get it (people manage their own mail). No
 * permission gives access to anyone else's preference: every query and action
 * is scoped to `session.user.id`.
 */
export const permissions = {
  statement: { notificationEmail: ["manage"] },
  grants: { member: { notificationEmail: ["manage"] } },
} as const satisfies ModulePermissions
