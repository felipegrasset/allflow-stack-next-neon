import type { ModulePermissions } from "../contract/types"

/**
 * `comment:create` — write comments (and delete your OWN).
 * `comment:delete` — moderate: delete anyone's comment.
 *
 * Seeing a thread is NOT a permission of this module: it depends on whether the
 * person can see the commented record, which only the host app knows (the
 * `canAccess` check passed to `<Comments>`). owner and admin get both (contract
 * default); member can create.
 */
export const permissions = {
  statement: { comment: ["create", "delete"] },
  grants: { member: { comment: ["create"] } },
} as const satisfies ModulePermissions
