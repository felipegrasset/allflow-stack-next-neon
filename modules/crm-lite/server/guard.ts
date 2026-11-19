import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import {
  getDefaultOrganizationId,
  getSession,
  requireOnboardedUser,
} from "@/server/session"

export type CrmResource = "contact" | "deal"
export type CrmAction = "read" | "write"

/**
 * Does the signed-in person have `resource:action` in the app's organization?
 * Asks Better Auth (`hasPermission`), so static roles (permissions.ts) and the
 * dynamic ones in "organizationRole" both count. Not a member, no session or
 * any error → false. Cached per request.
 */
export const can = cache(
  async (resource: CrmResource, action: CrmAction): Promise<boolean> => {
    const session = await getSession()
    if (!session) return false
    const organizationId = await getDefaultOrganizationId()
    if (!organizationId) return false
    try {
      const res = await auth.api.hasPermission({
        headers: await headers(),
        body: { organizationId, permissions: { [resource]: [action] } },
      })
      return res.success === true
    } catch {
      return false
    }
  }
)

/** Pages: signed in and onboarded (else /login or /onboarding), and every permission (else 403). */
export async function requirePagePermission(
  next: string,
  ...needs: [CrmResource, CrmAction][]
): Promise<Session> {
  const session = await requireOnboardedUser(next)
  for (const [resource, action] of needs)
    if (!(await can(resource, action))) forbidden()
  return session
}

/**
 * Server Actions: same check, but returns null instead of rendering the 403
 * page, so the action can answer with a form error. Call it BEFORE touching
 * any data (actions are reachable by direct POST).
 */
export async function actionSession(
  next: string,
  ...needs: [CrmResource, CrmAction][]
): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const [resource, action] of needs)
    if (!(await can(resource, action))) return null
  return session
}
