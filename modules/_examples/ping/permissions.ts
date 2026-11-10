import type { ModulePermissions } from "../contract/types"

export const permissions = {
  statement: { ping: ["read", "write"] },
  // owner and admin get the whole statement by default; member only reads.
  grants: { member: { ping: ["read"] } },
} as const satisfies ModulePermissions
