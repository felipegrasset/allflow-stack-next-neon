/**
 * The names of server/e2e-faults.ts, without its server imports — so the
 * Playwright specs can import them too.
 */
export const E2E_FAULT_COOKIE = "allflow-e2e-fault"

export type E2EFault =
  /** Throws in /settings/profile → app/error.tsx. */
  | "page-error"
  /** Throws in the root layout → app/global-error.tsx. */
  | "layout-error"
  /** Throws in /admin/users → its own error.tsx (retry). */
  | "admin-users-error"
  /** /admin/users as if the admin were the only member → empty state. */
  | "admin-users-empty"
  /** Holds /admin/users and /settings/profile 1.5 s → their loading.tsx skeletons. */
  | "slow"
