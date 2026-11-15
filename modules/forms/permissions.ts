import type { ModulePermissions } from "../contract/types"

/**
 * `form:read` — see the forms and their results (including every answer).
 * `form:write` — create forms, open/close them and delete them.
 *
 * owner and admin get both (contract default). member gets `read`: results
 * can hold personal data, so writing stays with admins unless an app widens
 * it with a dynamic role ("organizationRole"). Answering a public form needs
 * no permission at all.
 */
export const permissions = {
  statement: { form: ["read", "write"] },
  grants: { member: { form: ["read"] } },
} as const satisfies ModulePermissions
