import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"
import { getTranslations } from "next-intl/server"

import {
  isNavItemVisible,
  moduleNavItemsIn,
  type ModuleNavArea,
} from "@/config/nav.modules"
import { moduleAdminAccess } from "@/modules/_generated/permissions"
import { adminAccessPairs } from "@/modules/contract/access"
import type { ModuleStatement } from "@/modules/contract/types"
import { labelKey } from "@/modules/i18n/ui/labels"
import { auth, type Session } from "@/server/auth"
import {
  getAppRole,
  getDefaultOrganizationId,
  getSession,
  isAdminRole,
  requireOnboardedUser,
} from "@/server/session"

/**
 * Permission checks of the module contract for layouts and navigation
 * (modules/README.md, «Área de administración» and «Dónde aparece un enlace»).
 * Every check goes through Better Auth's `hasPermission`, so static roles
 * (lib/permissions.ts) and dynamic ones ("organizationRole") both count.
 */

type HasPermission = (args: {
  headers: Headers
  body: { organizationId: string; permissions: Record<string, string[]> }
}) => Promise<{ success: boolean }>

/** One Better Auth call per distinct permission set and request. Any failure → false. */
const checkPermissions = cache(async (key: string): Promise<boolean> => {
  const session = await getSession()
  if (!session) return false
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    // Module resources are typed only after `modules:sync`; the body is checked at runtime.
    const hasPermission = auth.api.hasPermission as unknown as HasPermission
    const res = await hasPermission({
      headers: await headers(),
      body: { organizationId, permissions: JSON.parse(key) as Record<string, string[]> },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Does the signed-in person hold ALL of `permissions` in the app's organization? */
export async function can(permissions: ModuleStatement): Promise<boolean> {
  const sorted = Object.fromEntries(
    Object.entries(permissions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([r, actions]) => [r, [...actions].sort()])
  )
  if (Object.keys(sorted).length === 0) return false
  return checkPermissions(JSON.stringify(sorted))
}

/** Owner or admin of the app's organization. */
export const isAppAdmin = cache(async (): Promise<boolean> => {
  const session = await getSession()
  if (!session) return false
  return isAdminRole(await getAppRole(session.user.id))
})

/** Owner/admin, or holder of at least one `adminAccess` permission of an installed module. */
export const canEnterAdmin = cache(async (): Promise<boolean> => {
  if (await isAppAdmin()) return true
  const results = await Promise.all(adminAccessPairs(moduleAdminAccess).map((p) => can(p)))
  return results.some(Boolean)
})

/**
 * The /admin gate (app/(app)/admin/layout.tsx): signed in and onboarded, and
 * `canEnterAdmin()`, else the 403 page. NOT a page guard: each admin page and
 * Server Action still checks its own permission (`/admin/users` keeps
 * `requireAdmin()`).
 */
export async function requireAdminArea(
  next?: string
): Promise<{ session: Session; isAdmin: boolean }> {
  const session = await requireOnboardedUser(next)
  if (!(await canEnterAdmin())) forbidden()
  return { session, isAdmin: await isAppAdmin() }
}

export type VisibleNavLink = { href: string; label: string }

/** The module links of `area` this person may see, labels already translated. */
export async function visibleModuleNav(area: ModuleNavArea): Promise<VisibleNavLink[]> {
  const items = moduleNavItemsIn(area)
  if (!items.length) return []
  const isAdmin = await isAppAdmin()
  const visible = await Promise.all(items.map((i) => isNavItemVisible(i, { isAdmin, can })))
  const t = await getTranslations()
  return items
    .filter((_, i) => visible[i])
    .map((i) => {
      const key = labelKey(i.label, (k) => t.has(k))
      return { href: i.href, label: key ? t(key) : i.label }
    })
}
