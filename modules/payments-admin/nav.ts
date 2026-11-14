import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/payments", label: "payments-admin.nav", adminOnly: true },
]
