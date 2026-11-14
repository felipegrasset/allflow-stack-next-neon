import type { ModulePermissions } from "../contract/types"

/**
 * `contact`: read = see contacts and their activity; write = create/edit
 * contacts and log activities.
 * `deal`: read = see the pipeline and deals; write = create and move deals.
 *
 * owner and admin get everything (contract default). member also gets
 * read+write: a CRM is a team tool and sales people need to write. An app that
 * wants read-only members narrows it with a dynamic role ("organizationRole").
 * Every page and Server Action checks these with Better Auth (server/guard.ts).
 */
export const permissions = {
  statement: { contact: ["read", "write"], deal: ["read", "write"] },
  grants: {
    member: { contact: ["read", "write"], deal: ["read", "write"] },
  },
} as const satisfies ModulePermissions
