import type { ModulePermissions } from "../contract/types"

/**
 * `plan:manage` — the catalog editor at /admin/plans: create, edit, publish,
 * archive plans, their provider plan id (`plan_ref`), the default plan and the
 * entitlements. That decides what a paying subscriber gets, so it is
 * owner/admin only (contract default); member gets nothing. It also opens the
 * /admin area (`adminAccess`) for a custom role that holds it.
 *
 * Seeing, changing or canceling your OWN plan on /settings/plan only needs a
 * session.
 */
export const permissions = {
  statement: { plan: ["manage"] },
  adminAccess: { plan: ["manage"] },
} as const satisfies ModulePermissions
