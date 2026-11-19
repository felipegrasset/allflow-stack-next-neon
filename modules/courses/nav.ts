import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. */
export const nav: ModuleNavItem[] = [
  { href: "/courses", label: "courses.nav" },
  // Course editor: shown in the /admin menu to whoever holds `course:write`.
  { href: "/admin/courses", label: "courses.navAdmin", area: "admin", permission: { course: ["write"] } },
]
