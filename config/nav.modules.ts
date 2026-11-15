/**
 * Where installed modules show up in the shell (T1). Read by
 * components/app-shell.tsx next to config/nav.ts — the genesis rewrites
 * nav.ts for the app's own entities, so modules never go there.
 *
 * Nothing to edit here: `pnpm modules:sync` fills modules/_generated/nav.ts
 * from each module's manifest (`entrypoints.nav`, `entrypoints.header`).
 *
 *  - `moduleNavItems`: links of the `main` area (the default), appended after
 *    the main navigation. A main link with `permission` arrives `adminOnly`,
 *    because AppShell only knows `isAdmin` (fails closed).
 *  - `moduleNavItemsIn(area)`: every link of an area (`main`, `settings`,
 *    `admin`). The /settings and /admin layouts filter them per person
 *    (server/module-access.ts → `visibleModuleNav`).
 *  - `moduleHeaderSlots`: server components rendered in the header, before the
 *    theme toggle (a bell with a counter, a language switcher…).
 */
import { mainNavForShell, navItemsIn } from "@/modules/contract/access"
import { moduleNavItems as allModuleNavItems } from "@/modules/_generated/nav"
import type { ModuleNavArea, ModuleNavItem } from "@/modules/contract/types"

export { moduleHeaderSlots } from "@/modules/_generated/nav"
export { isNavItemVisible, navAreaOf } from "@/modules/contract/access"
export type {
  ModuleHeaderSlot,
  ModuleHeaderSlotProps,
  ModuleNavArea,
  ModuleNavItem,
} from "@/modules/contract/types"

/** Every module link of `area`, in registry order. */
export const moduleNavItemsIn = (area: ModuleNavArea): ModuleNavItem[] =>
  navItemsIn(area, allModuleNavItems)

/** The `main` links for AppShell. */
export const moduleNavItems: ModuleNavItem[] = mainNavForShell(allModuleNavItems)
