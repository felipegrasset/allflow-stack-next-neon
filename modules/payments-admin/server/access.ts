import { headers } from "next/headers"
import { forbidden } from "next/navigation"

import { auth } from "@/server/auth"
import type { Session } from "@/server/auth"
import { getDefaultOrganizationId, requireOnboardedUser } from "@/server/session"

import { PAYMENTS_ADMIN_PATH } from "../contracts"

export type PaymentPermission = "read" | "refund"

type HasPermissionBody = NonNullable<Parameters<typeof auth.api.hasPermission>[0]>["body"]

/**
 * `payment:<action>` for the signed-in person in the app's organization,
 * through Better Auth (static roles of lib/permissions.ts plus the dynamic
 * ones of "organizationRole"). Any failure counts as "no".
 */
export async function hasPaymentPermission(
  action: PaymentPermission
): Promise<boolean> {
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    const res = await auth.api.hasPermission({
      headers: await headers(),
      // The body's type is inferred from the generated statements: `payment`
      // only exists there after `pnpm modules:sync` registers this module.
      // The cast keeps the module compiling before that; Better Auth
      // validates the body at runtime anyway.
      body: {
        organizationId,
        permissions: { payment: [action] },
      } as unknown as HasPermissionBody,
    })
    return res.success === true
  } catch {
    return false
  }
}

/**
 * The guard of every page and Server Action of the admin screen: a signed-in,
 * onboarded person who holds `payment:<action>` (a static or dynamic role, as
 * Better Auth merges them). It is NOT an "is admin" check: a custom role with
 * `payment:read` gets in, and refunding still needs `payment:refund`. Server
 * Actions are reachable by direct POST, so each one calls this itself.
 * Otherwise the 403 page.
 */
export async function requirePaymentPermission(
  action: PaymentPermission
): Promise<Session> {
  const session = await requireOnboardedUser(PAYMENTS_ADMIN_PATH)
  if (!(await hasPaymentPermission(action))) forbidden()
  return session
}
