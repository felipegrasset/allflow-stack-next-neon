/**
 * Pure rules of the module contract for navigation areas and the /admin door.
 * No runtime imports: config/nav.modules.ts and server/module-access.ts apply
 * them, the tests run them without a database or Next.
 */
import type { ModuleNavArea, ModuleNavItem, ModuleStatement } from "./types"

/** The area of a link; `main` when the module did not say. */
export const navAreaOf = (item: ModuleNavItem): ModuleNavArea => item.area ?? "main"

/** Every link of `area`, in the given order. */
export function navItemsIn(
  area: ModuleNavArea,
  items: readonly ModuleNavItem[]
): ModuleNavItem[] {
  return items.filter((i) => navAreaOf(i) === area)
}

/**
 * Who sees a link. Owner/admin see everything. Otherwise: a link with
 * `permission` needs all of it; an `adminOnly` link without `permission`, or
 * any link of the `admin` area without `permission`, is for admins only; the
 * rest is for everyone signed in. Visibility only — every page checks again.
 */
export async function isNavItemVisible(
  item: ModuleNavItem,
  who: { isAdmin: boolean; can: (permissions: ModuleStatement) => Promise<boolean> }
): Promise<boolean> {
  if (who.isAdmin) return true
  if (item.permission && Object.keys(item.permission).length > 0)
    return who.can(item.permission)
  if (item.adminOnly || navAreaOf(item) === "admin") return false
  return true
}

/**
 * The `main` links as AppShell takes them: it only knows `isAdmin`, so a link
 * with `permission` becomes `adminOnly` (fails closed until the shell checks
 * permissions itself).
 */
export function mainNavForShell(items: readonly ModuleNavItem[]): ModuleNavItem[] {
  return navItemsIn("main", items).map((i) =>
    i.permission ? { ...i, adminOnly: true } : i
  )
}

/**
 * Every `resource:action` of the modules' `adminAccess`, one permission set
 * per pair, without repeats: holding ANY ONE of them opens /admin.
 */
export function adminAccessPairs(
  access: readonly { permissions: ModuleStatement }[]
): ModuleStatement[] {
  const seen = new Set<string>()
  const out: ModuleStatement[] = []
  for (const { permissions } of access)
    for (const [resource, actions] of Object.entries(permissions))
      for (const action of actions) {
        const k = `${resource}:${action}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push({ [resource]: [action] })
      }
  return out
}
