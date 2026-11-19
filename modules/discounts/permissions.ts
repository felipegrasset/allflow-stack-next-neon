import type { ModulePermissions } from "../contract/types"

/**
 * `discount:manage` — /admin/discounts: create and edit codes, activate or
 * deactivate them and see their uses. It decides how much money a buyer
 * stops paying, so it is owner/admin only (contract default); member gets
 * nothing. It also opens the /admin area (`adminAccess`) for a custom role
 * that holds it.
 *
 * Typing a code on your OWN pending order needs no permission: a session and
 * being the order's buyer (checked on the server).
 */
export const permissions = {
  statement: { discount: ["manage"] },
  adminAccess: { discount: ["manage"] },
} as const satisfies ModulePermissions
