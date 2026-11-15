import type { ModuleNavItem } from "../contract/types"

/**
 * `label` is a catalog key (messages.ts): AppShell translates it.
 * - /settings/plan: a tab of /settings for anyone signed in (your own plan).
 * - /admin/plans: the catalog editor, in the /admin menu, for `plan:manage`.
 */
export const nav: ModuleNavItem[] = [
  { href: "/settings/plan", label: "plans.nav", area: "settings" },
  { href: "/admin/plans", label: "plans.navAdmin", area: "admin", permission: { plan: ["manage"] } },
]
