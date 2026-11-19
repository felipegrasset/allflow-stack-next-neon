import { cache } from "react"
import { headers } from "next/headers"

import { auth, type Session } from "@/server/auth"
import { getDefaultOrganizationId, getSession, requireOnboardedUser } from "@/server/session"

export type CommentAction = "create" | "delete"

/**
 * Does the signed-in person have `comment:<action>` in the app's organization?
 * Asks Better Auth (`hasPermission`): static and dynamic roles both count.
 * Any failure → false. Cached per request. The `comment` resource is not in the
 * generated permission types until `pnpm modules:sync` runs: bounded cast.
 */
export const can = cache(async (action: CommentAction): Promise<boolean> => {
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
      body: { organizationId, permissions: { comment: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
})

/** Server Actions: session + every permission, else null. Call BEFORE touching data. */
export async function actionSession(next: string, ...needs: CommentAction[]): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await can(a))) return null
  return session
}
