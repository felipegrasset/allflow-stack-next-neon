import type { ModulePermissions } from "../contract/types"

/**
 * `item:read`  — see /catalog and /catalog/[id] (products, stock and moves).
 * `item:write` — create and edit products and categories, record stock moves,
 *                add and remove photos.
 *
 * The public store (/productos) needs no permission and no session.
 * owner and admin get everything (contract default); member can read the
 * catalog (e.g. to check stock) but not change it. Give `item:write` to a
 * dynamic role ("organizationRole") for whoever manages the inventory.
 * Checked with Better Auth through `can()` (server/guard.ts).
 */
export const permissions = {
  statement: { item: ["read", "write"] },
  grants: { member: { item: ["read"] } },
} as const satisfies ModulePermissions
