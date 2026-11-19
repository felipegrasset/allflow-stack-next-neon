import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. */
export const nav: ModuleNavItem[] = [
  { href: "/tickets", label: "tickets.nav" },
  // Staff inbox: shown in the /admin menu to whoever holds `ticket:manage`.
  { href: "/admin/tickets", label: "tickets.navAdmin", area: "admin", permission: { ticket: ["manage"] } },
]
