import type { ModulePermissions } from "../contract/types"

/**
 * `setting:read`  — see the admin screen and the current values.
 * `setting:write` — change or reset a value.
 *
 * owner and admin get both by default; member gets nothing. `setting:read` is
 * also `adminAccess`: it opens the /admin area (app/(app)/admin/layout.tsx), so
 * a custom role with it reaches /admin/settings without being admin. The page
 * and every action still check their own permission (server/guard.ts).
 */
export const permissions = {
  statement: { setting: ["read", "write"] },
  adminAccess: { setting: ["read"] },
} as const satisfies ModulePermissions
