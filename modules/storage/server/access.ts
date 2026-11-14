import { headers } from "next/headers"

import { auth } from "@/server/auth"
import {
  getAppRole,
  getDefaultOrganizationId,
  getSession,
  isAdminRole,
} from "@/server/session"

import type { FileAction, Viewer } from "./policy"

type HasPermissionBody = NonNullable<
  Parameters<typeof auth.api.hasPermission>[0]
>["body"]

/**
 * `file:<action>` for the signed-in user, against their role in the app's
 * organization — static roles (lib/permissions.ts) and dynamic ones
 * ("organizationRole") alike, through Better Auth. Any error is a "no".
 */
async function hasFilePermission(action: FileAction): Promise<boolean> {
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    // The typed statement only learns `file` after `pnpm modules:sync`
    // regenerates modules/_generated/permissions.ts; the endpoint takes any
    // record at runtime, so the body is cast to stay valid before and after.
    const body = { organizationId, permissions: { file: [action] } }
    const res = await auth.api.hasPermission({
      headers: await headers(),
      body: body as unknown as HasPermissionBody,
    })
    return res.success === true
  } catch {
    return false
  }
}

/** The current viewer for the policy (server/policy.ts), or null without a session. */
export async function currentViewer(): Promise<Viewer | null> {
  const session = await getSession()
  if (!session) return null
  const role = await getAppRole(session.user.id)
  const cache = new Map<FileAction, Promise<boolean>>()
  return {
    id: session.user.id,
    isAdmin: isAdminRole(role),
    can: (action) => {
      if (!cache.has(action)) cache.set(action, hasFilePermission(action))
      return cache.get(action)!
    },
  }
}
