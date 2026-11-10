/**
 * Where installed modules show up in the shell (T1). Read by
 * components/app-shell.tsx next to config/nav.ts — the genesis rewrites
 * nav.ts for the app's own entities, so modules never go there.
 *
 * Nothing to edit here: `pnpm modules:sync` fills modules/_generated/nav.ts
 * from each module's manifest (`entrypoints.nav`, `entrypoints.header`).
 *
 *  - `moduleNavItems`: links appended after the main navigation.
 *  - `moduleHeaderSlots`: server components rendered in the header, before the
 *    theme toggle (a bell with a counter, a language switcher…).
 */
export { moduleHeaderSlots, moduleNavItems } from "@/modules/_generated/nav"
export type {
  ModuleHeaderSlot,
  ModuleHeaderSlotProps,
  ModuleNavItem,
} from "@/modules/contract/types"
