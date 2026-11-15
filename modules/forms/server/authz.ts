import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type FormAction = "read" | "write"

/**
 * Does the signed-in person have `form:<action>` in the app's organization?
 * Asks Better Auth (`hasPermission`), so the static roles (permissions.ts) and
 * the dynamic ones ("organizationRole") both count. No session, not a member
 * or any error → false. Cached per request.
 *
 * `form` is registered in `modules/_generated/permissions.ts` by `modules:sync`;
 * until then Better Auth's types do not know the resource, hence the narrow cast.
 */
export const can = cache(async (action: FormAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { form: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded (else /login or /onboarding), and the permission (else 403). */
export async function requirePagePermission(next: string, action: FormAction): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await can(action))) forbidden()
  return session
}

/**
 * Server Actions: same check, but null instead of the 403 page so the action
 * can answer with an error. Call it BEFORE touching any data.
 */
export async function actionSession(next: string, action: FormAction): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  return (await can(action)) ? session : null
}
