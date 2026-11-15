import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. The public pages live at /ayuda. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/help", label: "help-center.nav", area: "admin", permission: { article: ["write"] } },
]
