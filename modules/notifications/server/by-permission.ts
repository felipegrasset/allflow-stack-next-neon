import { sql } from "kysely"
import { z } from "zod"

import { roles } from "@/lib/permissions"
import { DEFAULT_ORG_SLUG } from "@/server/auth/bootstrap"
import { getKysely } from "@/server/db/pool"

import { notifyInputSchema, type NotifyInput } from "../contracts/input"
import { notify } from "./notify"
import {
  pickRecipients,
  recipientNotificationId,
  rolesGranting,
  type Statements,
} from "./recipients"

/** Default and hard cap of recipients per call (a role like `member` may hold the permission). */
export const RECIPIENTS_DEFAULT_LIMIT = 100
export const RECIPIENTS_MAX_LIMIT = 500

const permissionSchema = z.object({
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
})

const optionsSchema = z
  .object({
    limit: z.number().int().min(1).max(RECIPIENTS_MAX_LIMIT).default(RECIPIENTS_DEFAULT_LIMIT),
    /** Left out of the result (e.g. the person who caused the event). */
    excludeUserIds: z.array(z.string().min(1)).max(1000).default([]),
  })
  .default({ limit: RECIPIENTS_DEFAULT_LIMIT, excludeUserIds: [] })

export type PermissionTarget = z.input<typeof permissionSchema>
export type RecipientsOptions = z.input<typeof optionsSchema>
export type RecipientsResult = { userIds: string[]; truncated: boolean }

// Widened on purpose: walking the inferred type of `roles` (every module's
// statements) costs tsc tens of seconds; only names and statements matter here.
const staticRoles = roles as unknown as Record<string, { statements: Statements }>
const staticStatements = (): Record<string, Statements> =>
  Object.fromEntries(Object.entries(staticRoles).map(([name, role]) => [name, role.statements]))

/**
 * Members of the app's organization who hold `resource:action`, through
 * static roles (lib/permissions.ts) or dynamic ones ("organizationRole"),
 * with Better Auth's merge rules (server/recipients.ts). Unique, oldest
 * membership first, at most `limit` (default 100, max 500; `truncated` says
 * whether there were more). No session needed: works in jobs and webhooks.
 */
export async function listUsersWithPermission(
  permission: PermissionTarget,
  options?: RecipientsOptions
): Promise<RecipientsResult> {
  const perm = permissionSchema.parse(permission)
  const opts = optionsSchema.parse(options)
  const db = getKysely()
  const org = await db
    .selectFrom("organization")
    .select("id")
    .where("slug", "=", DEFAULT_ORG_SLUG)
    .executeTakeFirst()
  if (!org) return { userIds: [], truncated: false }

  const dynamicRows = await db
    .selectFrom("organizationRole")
    .select(["role", "permission"])
    .where("organizationId", "=", org.id)
    .execute()
  const granting = rolesGranting(perm, staticStatements(), dynamicRows)
  if (!granting.length) return { userIds: [], truncated: false }

  // Split the comma-separated role in SQL, as Better Auth does (no trimming).
  let q = db
    .selectFrom("member")
    .select("userId")
    .where("organizationId", "=", org.id)
    .where(
      sql<boolean>`exists (select 1 from unnest(string_to_array(${sql.ref("member.role")}, ',')) as r(name) where r.name in (${sql.join(granting)}))`
    )
  if (opts.excludeUserIds.length) q = q.where("userId", "not in", opts.excludeUserIds)
  const rows = await q
    .orderBy("createdAt")
    .orderBy("userId")
    .limit(opts.limit + 1)
    .execute()
  return pickRecipients(
    rows.map((r) => r.userId),
    { limit: opts.limit }
  )
}

export type NotifyPermissionPayload = Omit<NotifyInput, "userId">
export type NotifyPermissionResult = RecipientsResult & { created: number; failed: number }

/**
 * `notify()` to every member holding `resource:action` (see
 * `listUsersWithPermission`). The payload is validated once before any query;
 * an invalid one throws `ZodError`. With `payload.id`, each recipient's aviso
 * gets the id `<id>:<userId>`, so repeating the call creates nothing new.
 * A failure for one recipient is counted (`failed`) and logged, not thrown.
 */
export async function notifyPermission(
  permission: PermissionTarget,
  payload: NotifyPermissionPayload,
  options?: RecipientsOptions
): Promise<NotifyPermissionResult> {
  notifyInputSchema.parse({ ...payload, userId: "validation-only" })
  if (payload.id) notifyInputSchema.shape.id.parse(recipientNotificationId(payload.id, "x".repeat(36)))
  const recipients = await listUsersWithPermission(permission, options)
  const results = await Promise.allSettled(
    recipients.userIds.map((userId) =>
      notify({
        ...payload,
        userId,
        id: payload.id ? recipientNotificationId(payload.id, userId) : undefined,
      })
    )
  )
  let created = 0
  let failed = 0
  for (const r of results) {
    if (r.status === "fulfilled") created += r.value.created ? 1 : 0
    else {
      failed += 1
      console.error("[notifications] notifyPermission: notify failed", r.reason)
    }
  }
  return { ...recipients, created, failed }
}
