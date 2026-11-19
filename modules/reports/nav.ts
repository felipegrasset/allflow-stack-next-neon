import type { ModuleNavItem } from "../contract/types"

/** Visible to whoever holds `report:view` (owner/admin by default, or a custom role); the page checks it again. */
export const nav: ModuleNavItem[] = [
  { href: "/reports", label: "reports.nav", permission: { report: ["view"] } },
]
