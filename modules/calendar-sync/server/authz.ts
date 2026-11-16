import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { getDefaultOrganizationId, getSession } from "@/server/session"

import type { Viewer } from "./oauth"

/**
 * `calendar:connect` for the signed-in person, in the app's organization,
 * through Better Auth (static and dynamic roles). No session or any error → false.
 * The `calendar` resource is typed only after `pnpm modules:sync`, hence the
 * bounded cast of `hasPermission` (as modules/approvals/server/authz.ts).
 */
export async function canConnectCalendar(): Promise<boolean> {
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
      body: { organizationId, permissions: { calendar: ["connect"] } },
    })
    return res.success === true
  } catch {
    return false
  }
}

/** The person behind the request, with the session id the OAuth state is bound to. */
export async function currentViewer(): Promise<Viewer | null> {
  const session = await getSession()
  if (!session) return null
  return { userId: session.user.id, sessionId: session.session.id, canConnect: await canConnectCalendar() }
}
