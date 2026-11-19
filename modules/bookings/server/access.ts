import { cache } from "react"
import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { getDefaultOrganizationId } from "@/server/session"

type HasPermissionBody = NonNullable<Parameters<typeof auth.api.hasPermission>[0]>["body"]

export type BookingAction = "create" | "cancel" | "manage"

/**
 * Whether the signed-in person holds `booking: <action>` in the app's
 * organization (static roles of lib/permissions.ts plus dynamic ones). False
 * with no session or on any error: fail closed.
 */
export const canBooking = cache(async (action: BookingAction): Promise<boolean> => {
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) return false
  try {
    // Better Auth types `permissions` from the merged statement, which only
    // knows `booking` after `pnpm modules:sync`; the cast keeps this file
    // compiling before and after the sync. The runtime check is the same.
    const body = {
      organizationId,
      permissions: { booking: [action] },
    } as unknown as HasPermissionBody
    const res = await auth.api.hasPermission({ headers: await headers(), body })
    return res?.success === true
  } catch {
    return false
  }
})
