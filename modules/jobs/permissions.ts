import type { ModulePermissions } from "../contract/types"

/**
 * `job:read` — open /admin/jobs and read the run history.
 * `job:run`  — start a job by hand from that page.
 *
 * owner and admin get both by default; member gets nothing. `job:read` is also
 * `adminAccess`: it opens the /admin area for a custom role. The cron handler
 * does not use these: it is authenticated by CRON_SECRET, not by a person.
 */
export const permissions = {
  statement: { job: ["read", "run"] },
  adminAccess: { job: ["read"] },
} as const satisfies ModulePermissions
