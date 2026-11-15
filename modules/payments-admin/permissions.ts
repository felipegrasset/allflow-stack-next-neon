import type { ModulePermissions } from "../contract/types"

/**
 * `payment:read`  — see payments and ask the provider for their real state.
 * `payment:refund` — ask the provider to refund an approved payment.
 *
 * owner and admin get both by default; member gets nothing. `payment:read`
 * is also `adminAccess`: it opens the /admin area (app/(app)/admin/layout.tsx).
 * Every page and Server Action checks its own permission with Better Auth's
 * `hasPermission` (server/access.ts), so a custom role without `refund` can
 * look but not refund.
 */
export const permissions = {
  statement: { payment: ["read", "refund"] },
  adminAccess: { payment: ["read"] },
} as const satisfies ModulePermissions
