import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `job:read`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/jobs", label: "jobs.nav", area: "admin", permission: { job: ["read"] } },
]
