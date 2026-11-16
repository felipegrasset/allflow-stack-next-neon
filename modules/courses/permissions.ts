import type { ModulePermissions } from "../contract/types"

/**
 * `course:read`  — open the courses you are enrolled in and mark lessons as seen.
 * `course:write` — manage EVERY course: create, edit, publish, enroll people.
 *
 * owner and admin get everything (contract default); member gets `read`.
 * Checked with Better Auth (server/guard.ts).
 *
 * `adminAccess`: `course:write` opens the /admin area (the course editor lives
 * there), so a custom role with it gets in without being admin.
 */
export const permissions = {
  statement: { course: ["read", "write"] },
  grants: { member: { course: ["read"] } },
  adminAccess: { course: ["write"] },
} as const satisfies ModulePermissions
