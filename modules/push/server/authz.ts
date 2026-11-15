import { cache } from "react"
import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { getDefaultOrganizationId, getSession } from "@/server/session"

/**
 * Does the signed-in person hold `push:subscribe` in the app's organization?
 * Asks Better Auth (static roles from lib/permissions.ts + dynamic ones).
 * No session, no organization or any error → false. Cached per request.
 *
 * The `push` resource is not in the generated permission types until
 * `pnpm modules:sync` runs, hence the bounded cast of `hasPermission`
 * (same as modules/approvals/server/authz.ts).
 */
export const canSubscribe = cache(async (): Promise<boolean> => {
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
      body: { organizationId, permissions: { push: ["subscribe"] } },
    })
    return res.success === true
  } catch {
    return false
  }
})
