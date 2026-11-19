import type { ModulePermissions } from "../contract/types"

/**
 * `report:view` — open /reports and see every dashboard (app-wide totals).
 * `report:edit` — reorder or remove cards. Sources (what tables a dashboard
 * reads) are set in code, never through this permission.
 * owner and admin get both; member gets nothing by default.
 */
export const permissions = {
  statement: { report: ["view", "edit"] },
  grants: { member: {} },
} as const satisfies ModulePermissions
