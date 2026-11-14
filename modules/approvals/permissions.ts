import type { ModulePermissions } from "../contract/types"

/**
 * `approval:request` — open a request (and run `$requester` transitions such
 * as cancelling one's own request).
 * `approval:decide` — run a transition through an organization role. The
 * flow still decides WHICH roles may run each transition: both checks apply.
 *
 * owner and admin get both by default; member can only request.
 */
export const permissions = {
  statement: { approval: ["request", "decide"] },
  grants: { member: { approval: ["request"] } },
} as const satisfies ModulePermissions
