import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, requireOnboardedUser } from "@/server/session"

export type ReportAction = "view" | "edit"

/**
 * `auth.api.hasPermission` typed against the statement merged from every
 * installed module. Until `modules:sync` adds `report` to it, the typed call
 * rejects the key, so it is called through this narrower signature (same
 * runtime endpoint and body).
 */
type HasPermission = (ctx: {
  headers: Headers
  body: { organizationId: string; permissions: Record<string, string[]> }
}) => Promise<{ success: boolean }>

/**
 * Whether the signed-in user may `view` or `edit` reports, in the app's
 * organization. Uses Better Auth's access control, so static roles AND roles
 * edited at runtime ("organizationRole") count. Not a member, no organization
 * or any error → false.
 */
export async function hasReportPermission(action: ReportAction): Promise<boolean> {
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    const check = auth.api.hasPermission as unknown as HasPermission
    const res = await check({
      headers: await headers(),
      body: { organizationId, permissions: { report: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
}

/** Session guard + permission, or the 403 page. Every page and action of the module calls it. */
export async function requireReportPermission(
  action: ReportAction,
  next: string
): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await hasReportPermission(action))) forbidden()
  return session
}
