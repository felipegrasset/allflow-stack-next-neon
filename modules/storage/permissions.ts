import type { ModulePermissions } from "../contract/types"

/**
 * `file:upload` — upload through POST /api/storage/upload.
 * `file:read`   — open a non-public file through GET /api/storage/[id]
 *                 (`members` files: any reader; `private` files: the owner or
 *                 an admin/owner of the app's organization).
 * `file:delete` — delete a file (the owner, or an admin/owner for any file).
 *
 * owner and admin get the whole statement (default). member gets all three,
 * but the ownership rule in server/policy.ts limits read/delete of private
 * files to their own. Remove an action from `member` (or from a dynamic role)
 * to take it away.
 */
export const permissions = {
  statement: { file: ["upload", "read", "delete"] },
  grants: { member: { file: ["upload", "read", "delete"] } },
} as const satisfies ModulePermissions
