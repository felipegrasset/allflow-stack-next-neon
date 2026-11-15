import type { ModuleNavItem } from "../contract/types"

/** `label` is a catalog key (messages.ts): AppShell translates it. Shown in the /admin menu to whoever holds `import:run`. */
export const nav: ModuleNavItem[] = [
  { href: "/admin/import", label: "csv-import.nav", area: "admin", permission: { import: ["run"] } },
]
