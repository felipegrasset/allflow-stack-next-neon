import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. A tab of /settings. */
export const nav: ModuleNavItem[] = [
  {
    href: "/settings/notifications",
    label: "notifications-email.nav",
    area: "settings",
    permission: { notificationEmail: ["manage"] },
  },
]
