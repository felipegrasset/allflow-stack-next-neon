import type { ModulePermissions } from "../contract/types"

/**
 * `order:read`   — buy (checkout) and see YOUR OWN orders (/orders, /orders/[id]).
 * `order:manage` — see EVERY order (/admin/orders), cancel pending or
 *                  under-review orders, mark paid orders as delivered.
 *
 * The cart (/carrito) needs no session and no permission (a cookie).
 * owner and admin get everything (contract default); member gets `read`.
 * `order:manage` opens the /admin area (the staff list lives there).
 * Checked with Better Auth through `can()` (server/guard.ts).
 */
export const permissions = {
  statement: { order: ["read", "manage"] },
  grants: { member: { order: ["read"] } },
  adminAccess: { order: ["manage"] },
} as const satisfies ModulePermissions
