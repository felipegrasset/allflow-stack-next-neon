import type { ColumnType, Generated } from "kysely"

/**
 * Kysely types for the tables of migration 0001 (Better Auth + organization).
 * Better Auth itself doesn't need them — they type the hooks and the seed, and
 * any app code that reads users. Column names are camelCase and quoted in SQL;
 * the user table is `"user"` (reserved word — always quote it by hand).
 */

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  onboardedAt: Timestamp | null
  locale: Generated<string>
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: string | null
  createdAt: Timestamp
}

export interface MemberTable {
  id: string
  organizationId: string
  userId: string
  role: Generated<string>
  createdAt: Timestamp
}

export interface OrganizationRoleTable {
  id: string
  organizationId: string
  role: string
  /** JSON: {"member":["create","update"]} */
  permission: string
  createdAt: Timestamp
  updatedAt: Timestamp | null
}

export interface Database {
  user: UserTable
  organization: OrganizationTable
  member: MemberTable
  organizationRole: OrganizationRoleTable
}
