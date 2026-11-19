import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type ArticleAction = "read" | "write"

/**
 * Does the signed-in person have `article:<action>` in the app's organization?
 * Asks Better Auth (`hasPermission`), so static roles (permissions.ts) and the
 * dynamic ones in "organizationRole" both count. No session, not a member or
 * any error → false. Cached per request.
 *
 * `article` is registered in `_generated/permissions.ts` only after
 * `modules:sync`, so the body is cast to a plain record (as approvals does).
 */
export const can = cache(async (action: ArticleAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { article: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded (else /login or /onboarding), and the permission (else 403). */
export async function requirePagePermission(next: string, action: ArticleAction): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await can(action))) forbidden()
  return session
}

/**
 * Server Actions: same check, but returns null instead of rendering the 403
 * page so the action can answer with a form error. Call it BEFORE touching
 * data (actions are reachable by direct POST).
 */
export async function actionSession(next: string, action: ArticleAction): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  return (await can(action)) ? session : null
}
