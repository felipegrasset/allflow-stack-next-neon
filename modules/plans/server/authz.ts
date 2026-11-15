import { cache } from "react"
import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { getDefaultOrganizationId, getSession } from "@/server/session"

/**
 * Does the signed-in person have `plan:manage` in the app's organization?
 * Better Auth merges the static roles (lib/permissions.ts, where this module's
 * statement lands after `modules:sync`) with the dynamic ones. No session, not
 * a member or any error → false. Cached per request.
 *
 * The cast is scoped to the body: before `modules:sync` registers the `plan`
 * resource, `hasPermission` is typed without it.
 */
export const canManagePlans = cache(async (): Promise<boolean> => {
  const session = await getSession()
  if (!session) return false
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    const hasPermission = auth.api.hasPermission as unknown as (args: {
      headers: Headers
      body: { organizationId: string; permissions: Record<string, string[]> }
    }) => Promise<{ success: boolean }>
    const res = await hasPermission({
      headers: await headers(),
      body: { organizationId, permissions: { plan: ["manage"] } },
    })
    return res.success === true
  } catch {
    return false
  }
})
