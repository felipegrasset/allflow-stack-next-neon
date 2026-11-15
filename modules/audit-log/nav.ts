import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `audit:read`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/audit", label: "audit-log.nav", area: "admin", permission: { audit: ["read"] } },
]
