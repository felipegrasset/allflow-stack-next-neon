import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

/**
 * `message:send` for the signed-in user, against their role in the app's
 * organization (static roles from lib/permissions.ts and dynamic ones alike),
 * through Better Auth. Any error, or no session, is a "no".
 */
export async function canSendWhatsApp(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    // The typed statement only learns `message` after `pnpm modules:sync`
    // regenerates modules/_generated/permissions.ts; the endpoint takes any
    // record at runtime, so the call is cast to stay valid before and after.
    const hasPermission = auth.api.hasPermission as unknown as (args: {
      headers: Headers
      body: { organizationId: string; permissions: Record<string, string[]> }
    }) => Promise<{ success: boolean }>
    const res = await hasPermission({
      headers: await headers(),
      body: { organizationId, permissions: { message: ["send"] } },
    })
    return res.success === true
  } catch {
    return false
  }
}

/**
 * Guard of the /admin/whatsapp screen and its Server Actions: signed in,
 * onboarded and holding `message:send` (not "is admin"), else the 403 page.
 * The screen lists phone numbers and the send form, so it is the console of
 * whoever may send; `message:send` is also this module's `adminAccess`.
 */
export async function requireWhatsAppAccess(next: string): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await canSendWhatsApp())) forbidden()
  return session
}
