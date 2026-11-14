import type { ModulePermissions } from "../contract/types"

/**
 * `booking`:
 * - `create`: book a free slot for oneself.
 * - `cancel`: cancel one's OWN booking before it starts.
 * - `manage`: see every booking, cancel anyone's (also once started), and
 *   manage resources and schedules.
 *
 * owner and admin get the whole statement (contract default); member books and
 * cancels its own. Every page and Server Action checks these through
 * server/access.ts (Better Auth `hasPermission` against the app's organization).
 */
export const permissions = {
  statement: { booking: ["create", "cancel", "manage"] },
  grants: { member: { booking: ["create", "cancel"] } },
} as const satisfies ModulePermissions
