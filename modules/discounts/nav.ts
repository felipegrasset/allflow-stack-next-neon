import type { ModuleNavItem } from "../contract/types"

/**
 * `label` is a catalog key (messages.ts): AppShell translates it.
 * /admin/discounts: in the /admin menu, for `discount:manage`. The buyer's
 * page (/orders/[id]/descuento) has no menu entry: it is linked from the order.
 */
export const nav: ModuleNavItem[] = [
  { href: "/admin/discounts", label: "discounts.nav", area: "admin", permission: { discount: ["manage"] } },
]
