import { randomUUID } from "node:crypto"
import { sql, type Kysely } from "kysely"

import { roles } from "@/lib/permissions"
import { APP_NAME, APP_TITLE } from "@/lib/site"
import type { Database } from "@/server/db/schema"

/**
 * The app's own organization and who administers it.
 *
 * Every generated app is born with ONE organization (the client's company).
 * The `admin` role lives in `"organizationRole"` (dynamic access control —
 * editable at runtime, AllFlow's `admin_roles` equivalent), and the first user
 * to register becomes its `admin` member. Both steps are idempotent: the seed
 * runs them on every `pnpm db:migrate`, and the `user.create.after` hook runs
 * the promotion on every sign-up (Better Auth queues it after the sign-up
 * transaction commits, so the user row is visible).
 */

export const DEFAULT_ORG_SLUG = APP_NAME
export const ADMIN_ROLE = "admin"
export const MEMBER_ROLE = "member"

export async function ensureDefaultOrganization(db: Kysely<Database>): Promise<string> {
  await db
    .insertInto("organization")
    .values({ id: randomUUID(), name: APP_TITLE, slug: DEFAULT_ORG_SLUG, createdAt: new Date() })
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute()
  const org = await db
    .selectFrom("organization")
    .select("id")
    .where("slug", "=", DEFAULT_ORG_SLUG)
    .executeTakeFirstOrThrow()

  await db
    .insertInto("organizationRole")
    .values({
      id: randomUUID(),
      organizationId: org.id,
      role: ADMIN_ROLE,
      permission: JSON.stringify(roles.admin.statements),
      createdAt: new Date(),
    })
    .onConflict((oc) => oc.columns(["organizationId", "role"]).doNothing())
    .execute()

  return org.id
}

/**
 * Make `userId` (or, without it, the earliest registered user) the admin of
 * the default organization — only if it has no admin yet. A single
 * INSERT … SELECT … WHERE NOT EXISTS, so two sign-ups racing can't both win
 * silently past the check (the unique (organizationId, userId) index and the
 * advisory lock cover the rest).
 */
export async function promoteFirstAdmin(db: Kysely<Database>, userId?: string): Promise<boolean> {
  const orgId = await ensureDefaultOrganization(db)
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext('allflow:first-admin'))`.execute(trx)
    const hasAdmin = await trx
      .selectFrom("member")
      .select("id")
      .where("organizationId", "=", orgId)
      .where("role", "in", [ADMIN_ROLE, "owner"])
      .executeTakeFirst()
    if (hasAdmin) return false

    const target =
      userId ??
      (await trx.selectFrom("user").select("id").orderBy("createdAt").orderBy("id").executeTakeFirst())?.id
    if (!target) return false

    await trx
      .insertInto("member")
      .values({ id: randomUUID(), organizationId: orgId, userId: target, role: ADMIN_ROLE, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["organizationId", "userId"]).doUpdateSet({ role: ADMIN_ROLE }))
      .execute()
    return true
  })
}

/**
 * Every user belongs to the app's organization (T2): the first one as `admin`
 * (promoteFirstAdmin), everyone after as `member` — so /admin/users, which
 * lists the organization's members, sees every account and can change its
 * role. Idempotent: an existing membership (whatever its role) is left alone.
 */
export async function joinDefaultOrganization(db: Kysely<Database>, userId: string): Promise<void> {
  if (await promoteFirstAdmin(db, userId)) return
  const orgId = await ensureDefaultOrganization(db)
  await db
    .insertInto("member")
    .values({ id: randomUUID(), organizationId: orgId, userId, role: MEMBER_ROLE, createdAt: new Date() })
    .onConflict((oc) => oc.columns(["organizationId", "userId"]).doNothing())
    .execute()
}

/** Seed backfill: users created before T2 (or by hand) that have no membership. */
export async function backfillMembers(db: Kysely<Database>): Promise<number> {
  const orgId = await ensureDefaultOrganization(db)
  const res = await sql`
    insert into member (id, "organizationId", "userId", role, "createdAt")
    select gen_random_uuid()::text, ${orgId}, u.id, ${MEMBER_ROLE}, now()
    from "user" u
    where not exists (select 1 from member m where m."organizationId" = ${orgId} and m."userId" = u.id)
    on conflict ("organizationId", "userId") do nothing`.execute(db)
  return Number(res.numAffectedRows ?? 0)
}
