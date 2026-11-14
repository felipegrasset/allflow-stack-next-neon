import type { ModulePermissions } from "../contract/types"

/**
 * `payment:read`  — see payments and ask the provider for their real state.
 * `payment:refund` — ask the provider to refund an approved payment.
 *
 * owner and admin get both by default; member gets nothing. The screens live
 * under /admin (admins only, app/(app)/admin/layout.tsx) AND every page and
 * Server Action checks the permission again with Better Auth's
 * `hasPermission` (server/access.ts), so a custom role without `refund` can
 * look but not refund.
 */
export const permissions = {
  statement: { payment: ["read", "refund"] },
} as const satisfies ModulePermissions
