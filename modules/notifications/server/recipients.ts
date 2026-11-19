/**
 * Who holds a permission — the pure half of `listUsersWithPermission`
 * (server/by-permission.ts runs the queries). No imports on purpose: the tests
 * run it transpiled, without the `@/` alias or a database.
 *
 * It mirrors Better Auth's organization `hasPermission` (better-auth
 * plugins/organization/has-permission + permission): the static roles of
 * lib/permissions.ts, with each dynamic "organizationRole" row MERGED onto the
 * static role of the same name (union of actions); a member's `role` is a
 * comma-separated list split WITHOUT trimming; any one role granting the
 * permission is enough.
 */

export type Statements = Readonly<Record<string, readonly string[]>>
export type PermissionRef = { resource: string; action: string }
export type DynamicRoleRow = { role: string; permission: string }

/** Roles of a member, split like Better Auth does (`role.split(",")`), empty names dropped. */
export function splitMemberRoles(role: string | null | undefined): string[] {
  return (role ?? "").split(",").filter((r) => r.length > 0)
}

/** Parses a dynamic role's JSON; null when it is not `{ resource: string[] }`. */
export function parseDynamicPermission(json: string): Record<string, string[]> | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v) || !v.every((a) => typeof a === "string")) return null
    out[k] = v as string[]
  }
  return out
}

/**
 * The names of the roles that grant `resource:action`. A dynamic row whose
 * JSON is invalid is skipped (Better Auth would fail the whole check: here
 * that role simply grants nothing — fails closed).
 */
export function rolesGranting(
  perm: PermissionRef,
  staticRoles: Readonly<Record<string, Statements>>,
  dynamicRows: readonly DynamicRoleRow[]
): string[] {
  const merged = new Map<string, Map<string, Set<string>>>()
  const add = (role: string, statements: Statements) => {
    const r = merged.get(role) ?? new Map<string, Set<string>>()
    for (const [res, actions] of Object.entries(statements)) {
      const set = r.get(res) ?? new Set<string>()
      for (const a of actions) set.add(a)
      r.set(res, set)
    }
    merged.set(role, r)
  }
  for (const [role, statements] of Object.entries(staticRoles)) add(role, statements)
  for (const row of dynamicRows) {
    const parsed = parseDynamicPermission(row.permission)
    if (parsed) add(row.role, parsed)
  }
  return [...merged]
    .filter(([, statements]) => statements.get(perm.resource)?.has(perm.action) === true)
    .map(([role]) => role)
    .sort()
}

/** Does a member whose `role` column is `role` hold the permission, given the granting role names? */
export function memberHasRole(role: string | null | undefined, granting: ReadonlySet<string>): boolean {
  return splitMemberRoles(role).some((r) => granting.has(r))
}

/** Unique user ids, `exclude` removed, first `limit` kept (input order). */
export function pickRecipients(
  userIds: readonly string[],
  opts: { limit: number; exclude?: readonly string[] }
): { userIds: string[]; truncated: boolean } {
  const skip = new Set(opts.exclude ?? [])
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of userIds) {
    if (skip.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return { userIds: out.slice(0, opts.limit), truncated: out.length > opts.limit }
}

/** Per-recipient idempotency key: `notify()` ids are global, so one key per user. */
export const recipientNotificationId = (id: string, userId: string) => `${id}:${userId}`
