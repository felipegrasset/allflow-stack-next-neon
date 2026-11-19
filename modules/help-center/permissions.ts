import type { ModulePermissions } from "../contract/types"

/**
 * `article:read` — see ALL articles (drafts included), their ratings and the
 * editor in read-only mode; also preview a draft at /ayuda/<slug>.
 * `article:write` — create, edit, publish, unpublish and delete articles.
 *
 * The public pages (/ayuda, /ayuda/<slug>) need no permission: they only ever
 * show published articles. owner and admin get both by default; member only
 * reads. Every page and Server Action checks with Better Auth (server/guard.ts).
 * `adminAccess`: `article:write` opens the /admin area (the editor lives there).
 */
export const permissions = {
  statement: { article: ["read", "write"] },
  grants: { member: { article: ["read"] } },
  adminAccess: { article: ["write"] },
} as const satisfies ModulePermissions
