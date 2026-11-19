import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. A tab of /settings for whoever holds `calendar:connect`. */
export const nav: ModuleNavItem[] = [
  { href: "/settings/calendar", label: "calendar-sync.nav", area: "settings", permission: { calendar: ["connect"] } },
]
