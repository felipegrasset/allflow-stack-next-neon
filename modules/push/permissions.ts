import type { ModulePermissions } from "../contract/types"

/**
 * `push:subscribe` — turn web push on or off for one's OWN devices and send
 * oneself a test. owner and admin get it (contract default) and so does
 * member. Checked with Better Auth (server/authz.ts) in the page, the route
 * handler and the Server Action. Nobody can see or touch another person's
 * subscriptions: every query is scoped to the session's user.
 */
export const permissions = {
  statement: { push: ["subscribe"] },
  grants: { member: { push: ["subscribe"] } },
} as const satisfies ModulePermissions
