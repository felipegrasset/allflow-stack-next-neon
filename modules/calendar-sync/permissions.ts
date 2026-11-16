import type { ModulePermissions } from "../contract/types"

/**
 * `calendar:connect` — connect (and disconnect, and sync) YOUR OWN Google
 * Calendar so your bookings show up there. Each person only ever reaches
 * their own account; there is no screen over other people's accounts.
 *
 * owner and admin get it (contract default) and so does member: it only
 * affects the person's own calendar. Remove the grant to turn the feature off
 * for members. Checked with Better Auth in server/authz.ts (pages, actions and
 * both OAuth route handlers). No `adminAccess`: nothing here lives in /admin.
 */
export const permissions = {
  statement: { calendar: ["connect"] },
  grants: { member: { calendar: ["connect"] } },
} as const satisfies ModulePermissions
