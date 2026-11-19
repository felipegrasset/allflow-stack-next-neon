import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type CourseAction = "read" | "write"

/**
 * Does the signed-in person have `course:<action>` in the app's organization?
 * Asks Better Auth (`hasPermission`), so static roles and dynamic ones both
 * count. No session, not a member or any error → false. Cached per request.
 *
 * The `course` resource is not in the generated permission types until
 * `pnpm modules:sync` runs, hence the bounded cast of `hasPermission`.
 */
export const can = cache(async (action: CourseAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { course: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded (else /login or /onboarding) and the permission (else 403). */
export async function requirePagePermission(next: string, action: CourseAction): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await can(action))) forbidden()
  return session
}

/**
 * Pages for people who study: `course:read` OR `course:write` (a manager who
 * only holds `write` can still preview). Returns the session and whether the
 * person manages courses.
 */
export async function requireCoursesViewer(next: string): Promise<{ session: Session; canManage: boolean }> {
  const session = await requireOnboardedUser(next)
  const [canRead, canManage] = await Promise.all([can("read"), can("write")])
  if (!canRead && !canManage) forbidden()
  return { session, canManage }
}

/** Server Actions: same check but returns null so the action can answer with an error. Call BEFORE touching data. */
export async function actionSession(next: string, ...needs: CourseAction[]): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) return null
  return session
}

/** Server Action of a student: `read` or `write`. */
export async function viewerSession(next: string): Promise<{ session: Session; canManage: boolean } | null> {
  const session = await requireOnboardedUser(next)
  const [canRead, canManage] = await Promise.all([can("read"), can("write")])
  if (!canRead && !canManage) return null
  return { session, canManage }
}
