import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type SettingAction = "read" | "write"

/**
 * Does the signed-in person have `setting:<action>` in the app's organization?
 * Better Auth merges static and dynamic roles. Any failure → false. Cached per request.
 */
export const can = cache(async (action: SettingAction): Promise<boolean> => {
  const session = await getSession()
  if (!session) return false
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    // `setting` is not in the generated permission types until `modules:sync` runs.
    const hasPermission = auth.api.hasPermission as unknown as (args: {
      headers: Headers
      body: { organizationId: string; permissions: Record<string, string[]> }
    }) => Promise<{ success: boolean }>
    const res = await hasPermission({
      headers: await headers(),
      body: { organizationId, permissions: { setting: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded, and the permission (else 403). */
export async function requirePagePermission(next: string, action: SettingAction): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await can(action))) forbidden()
  return session
}

/** Server Actions: like the page guard but returns null instead of the 403 page. Call BEFORE touching data. */
export async function actionSession(next: string, action: SettingAction): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  return (await can(action)) ? session : null
}
