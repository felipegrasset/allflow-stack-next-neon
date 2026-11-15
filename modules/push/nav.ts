import type { ModuleNavItem } from "../contract/types"

/** A tab of /settings for whoever holds `push:subscribe`. `label` is a catalog key (messages.ts). */
export const nav: ModuleNavItem[] = [
  { href: "/settings/notifications-push", label: "push.nav", area: "settings", permission: { push: ["subscribe"] } },
]
