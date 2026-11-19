import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `payment:read`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/payments", label: "payments-admin.nav", area: "admin", permission: { payment: ["read"] } },
]
