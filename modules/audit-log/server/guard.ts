import { cache } from "react"
import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

type HasPermissionBody = NonNullable<Parameters<typeof auth.api.hasPermission>[0]>["body"]

/**
 * `audit:read` for the signed-in person in the app's organization, through
 * Better Auth (static roles plus dynamic "organizationRole"). Any failure → false.
 */
export const canReadAudit = cache(async (): Promise<boolean> => {
  const session = await getSession()
  if (!session) return false
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    const res = await auth.api.hasPermission({
      headers: await headers(),
      // `audit` is only in the generated statements after `pnpm modules:sync`;
      // the cast keeps this compiling before that (Better Auth validates at runtime).
      body: { organizationId, permissions: { audit: ["read"] } } as unknown as HasPermissionBody,
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Pages: signed in and onboarded (else /login or /onboarding), and `audit:read` (else 403). */
export async function requireAuditReader(next: string): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await canReadAudit())) forbidden()
  return session
}
