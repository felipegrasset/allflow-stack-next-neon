import type { ModulePermissions } from "../contract/types"

/**
 * `audit:read` — open /admin/audit and read the log.
 *
 * owner and admin get it by default; member gets nothing. Writing is not a
 * permission: `recordAudit()` is called by trusted server code, never by a
 * form. `audit:read` is also `adminAccess`: it opens the /admin area, and the
 * page checks the permission again with Better Auth (server/guard.ts).
 */
export const permissions = {
  statement: { audit: ["read"] },
  adminAccess: { audit: ["read"] },
} as const satisfies ModulePermissions
