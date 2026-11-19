import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type JobAction = "read" | "run"

/**
 * Does the signed-in person have `job:<action>` in the app's organization?
 * Through Better Auth `hasPermission` (static and dynamic roles). Any failure → false.
 * `job` is only in the generated permission types after `pnpm modules:sync`,
 * hence the bounded cast.
 */
export const can = cache(async (action: JobAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { job: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded, and every permission (else 403). */
export async function requirePagePermission(next: string, ...needs: JobAction[]): Promise<Session> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) forbidden()
  return session
}

/** Server Actions: null when not allowed. Call BEFORE touching data. */
export async function actionSession(next: string, ...needs: JobAction[]): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) return null
  return session
}
