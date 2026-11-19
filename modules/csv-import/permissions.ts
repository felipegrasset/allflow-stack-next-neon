import type { ModulePermissions } from "../contract/types"

/**
 * `import:run` — preview and run CSV imports, and see the history of runs.
 *
 * owner and admin get it by default; member gets nothing. It is also
 * `adminAccess`: it opens the /admin area, so a custom role with it reaches
 * /admin/import without being admin. The page and every action still check it.
 */
export const permissions = {
  statement: { import: ["run"] },
  adminAccess: { import: ["run"] },
} as const satisfies ModulePermissions
