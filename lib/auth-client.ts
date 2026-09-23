"use client"

import { createAuthClient } from "better-auth/react"
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"

/**
 * Browser-side auth client (same origin, so no baseURL). Server code uses
 * `auth.api.*` from server/auth instead.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient({ dynamicAccessControl: { enabled: true } }), magicLinkClient()],
})
