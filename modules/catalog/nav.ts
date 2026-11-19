import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown to whoever holds `item:read`. */
export const nav: ModuleNavItem[] = [
  { href: "/catalog", label: "catalog.nav", permission: { item: ["read"] } },
]
