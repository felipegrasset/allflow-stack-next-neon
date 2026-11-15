import type { ModulePermissions } from "../contract/types"

/**
 * `ticket:create` — open a ticket.
 * `ticket:read`   — see and answer YOUR OWN tickets.
 * `ticket:manage` — see and answer EVERY ticket and change its status
 *                   (staff inbox at /admin/tickets).
 *
 * owner and admin get everything (contract default); member can create and
 * read (their own). Checked with Better Auth (server/guard.ts).
 *
 * `adminAccess`: `ticket:manage` opens the /admin area (the staff inbox lives there),
 * so a custom role with it gets in without being admin.
 */
export const permissions = {
  statement: { ticket: ["create", "read", "manage"] },
  grants: { member: { ticket: ["create", "read"] } },
  adminAccess: { ticket: ["manage"] },
} as const satisfies ModulePermissions
