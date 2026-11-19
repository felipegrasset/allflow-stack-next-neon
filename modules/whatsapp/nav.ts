import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `message:send`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/whatsapp", label: "whatsapp.nav", area: "admin", permission: { message: ["send"] } },
]
