import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. */
export const nav: ModuleNavItem[] = [
  { href: "/carrito", label: "orders.navCart" },
  { href: "/orders", label: "orders.nav", permission: { order: ["read"] } },
  { href: "/admin/orders", label: "orders.navAdmin", area: "admin", permission: { order: ["manage"] } },
]
