import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { getAppRole, getDefaultOrganizationId, getSession } from "@/server/session"

import { ApprovalError } from "../contracts/errors"
import type { Actor } from "./decision"

export function splitRoles(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
}

/**
 * Better Auth's check, which merges the static roles (lib/permissions.ts, where
 * this module's grants land) with the dynamic ones ("organizationRole").
 * Any failure (not a member, no organization) counts as "no".
 */
async function hasApprovalPermission(
  organizationId: string,
  action: "request" | "decide"
): Promise<boolean> {
  try {
    const hasPermission = auth.api.hasPermission as unknown as (args: {
      headers: Headers
      body: { organizationId: string; permissions: Record<string, string[]> }
    }) => Promise<{ success: boolean }>
    const res = await hasPermission({
      headers: await headers(),
      body: { organizationId, permissions: { approval: [action] } },
    })
    return res.success === true
  } catch {
    return false
  }
}

/**
 * The actor of the current request, from the session cookie. Throws
 * `ApprovalError("unauthenticated")` without a session. Only works inside a
 * request (page, Server Action, route handler), never in a background job.
 */
export async function currentActor(): Promise<Actor> {
  const session = await getSession()
  if (!session) throw new ApprovalError("unauthenticated")
  const [role, orgId] = await Promise.all([
    getAppRole(session.user.id),
    getDefaultOrganizationId(),
  ])
  const roles = splitRoles(role)
  if (!orgId || roles.length === 0)
    return { userId: session.user.id, roles, can: { request: false, decide: false } }
  const [request, decide] = await Promise.all([
    hasApprovalPermission(orgId, "request"),
    hasApprovalPermission(orgId, "decide"),
  ])
  return { userId: session.user.id, roles, can: { request, decide } }
}
