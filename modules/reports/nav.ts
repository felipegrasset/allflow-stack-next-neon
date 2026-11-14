import type { ModuleNavItem } from "../contract/types"

/**
 * `adminOnly`: by default only owner and admin hold `report:view`. A member
 * granted it through a runtime role can still open /reports by URL.
 */
export const nav: ModuleNavItem[] = [
  { href: "/reports", label: "reports.nav", adminOnly: true },
]
