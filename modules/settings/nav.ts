import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `setting:read`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/settings", label: "settings.nav", area: "admin", permission: { setting: ["read"] } },
]
