import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type TicketAction = "create" | "read" | "manage"

/**
 * Does the signed-in person have `ticket:<action>` in the app's organization?
 * Asks Better Auth (`hasPermission`), so static roles and dynamic ones both
 * count. No session, not a member or any error → false. Cached per request.
 *
 * The `ticket` resource is not in the generated permission types until
 * `pnpm modules:sync` runs, hence the bounded cast of `hasPermission`.
 */
export const can = cache(async (action: TicketAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { ticket: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded (else /login or /onboarding) and every permission (else 403). */
export async function requirePagePermission(next: string, ...needs: TicketAction[]): Promise<Session> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) forbidden()
  return session
}

/** Server Actions: same check but returns null so the action can answer with an error. Call BEFORE touching data. */
export async function actionSession(next: string, ...needs: TicketAction[]): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) return null
  return session
}
