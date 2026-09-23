import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

/**
 * The app's permission statements — the EXTENSION POINT for RBAC (outside the
 * read-only server/auth/** zone on purpose). Add the app's resources here:
 *
 *   const statement = { ...defaultStatements, project: ["create", "update", "delete"] } as const
 *
 * then grant them in the roles below. Roles can also be created at runtime in
 * the "organizationRole" table (dynamic access control); those are merged on
 * top of these static ones.
 */
export const statement = { ...defaultStatements } as const

export const ac = createAccessControl(statement)

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements }),
  admin: ac.newRole({ ...adminAc.statements }),
  member: ac.newRole({ ...memberAc.statements }),
}
