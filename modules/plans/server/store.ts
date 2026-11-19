import { randomUUID } from "node:crypto"
import { sql, type Kysely, type Selectable, type Transaction } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  archiveProblem,
  defaultProblem,
  publishBlockers,
  type Entitlement,
  type Plan,
  type RequestSnapshot,
} from "../contracts/domain"
import { PlansError } from "../contracts/errors"
import type { CreatePlan, SetEntitlement, UpdatePlan } from "../contracts/input"
import type {
  PlansEntitlementsTable,
  PlansPlansTable,
  PlansSubscriptionRequestsTable,
} from "../db/types"

/**
 * Data access of the plans module. Callers check permissions first (the
 * Server Actions do); the read functions are what `contracts/` exposes.
 * Every write runs in ONE transaction that locks the rows it decides on
 * (`for update`), so two editors cannot leave the catalog half-changed. The
 * table checks of 0128 are the backstop: a published plan has a `plan_ref` and
 * is not archived; the default plan is not archived; at most one default.
 */
type Db = Kysely<Database>
type Trx = Transaction<Database>

/** pg error code of a check violation. */
export function isCheckViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23514"
  )
}

/** pg error code of a unique violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23505"
  )
}

function toEntitlement(r: Selectable<PlansEntitlementsTable>): Entitlement {
  let limit: number | null = null
  if (r.kind === "limit" && r.limit_value !== null) {
    const n = Number(r.limit_value)
    // The column check keeps it <= 1e12; anything odd fails closed to 0.
    limit = Number.isSafeInteger(n) && n >= 0 ? n : 0
  }
  return {
    key: r.key,
    kind: r.kind,
    enabled: r.kind === "feature" && r.enabled === true,
    limit,
    labelEs: r.label_es,
    labelEn: r.label_en,
  }
}

function toPlan(
  r: Selectable<PlansPlansTable>,
  entitlements: Selectable<PlansEntitlementsTable>[]
): Plan {
  return {
    id: r.id,
    key: r.key,
    nameEs: r.name_es,
    nameEn: r.name_en,
    descriptionEs: r.description_es,
    descriptionEn: r.description_en,
    planRef: r.plan_ref,
    isDefault: r.is_default,
    active: r.active,
    published: r.published,
    priceNoteEs: r.price_note_es,
    priceNoteEn: r.price_note_en,
    sort: r.sort,
    entitlements: entitlements
      .filter((e) => e.plan_id === r.id)
      .map(toEntitlement)
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}

async function withEntitlements(
  db: Db,
  rows: Selectable<PlansPlansTable>[]
): Promise<Plan[]> {
  if (rows.length === 0) return []
  const ents = await db
    .selectFrom("plans_entitlements")
    .selectAll()
    .where(
      "plan_id",
      "in",
      rows.map((r) => r.id)
    )
    .execute()
  return rows.map((r) => toPlan(r, ents))
}

async function one(db: Db, row: Selectable<PlansPlansTable> | undefined) {
  if (!row) return null
  const [plan] = await withEntitlements(db, [row])
  return plan ?? null
}

/** The plan a provider plan id maps to (active or archived: existing subscribers keep it). */
export async function findPlanByRef(db: Db, planRef: string): Promise<Plan | null> {
  const row = await db
    .selectFrom("plans_plans")
    .selectAll()
    .where("plan_ref", "=", planRef)
    .executeTakeFirst()
  return one(db, row)
}

export async function findDefaultPlan(db: Db): Promise<Plan | null> {
  const row = await db
    .selectFrom("plans_plans")
    .selectAll()
    .where("is_default", "=", true)
    .executeTakeFirst()
  return one(db, row)
}

export async function findPlanById(db: Db, id: string): Promise<Plan | null> {
  const row = await db
    .selectFrom("plans_plans")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()
  return one(db, row)
}

/**
 * The catalog, by `sort` then key.
 * - `published` (default): what is for sale today (published, not archived, with a `plan_ref`).
 * - `all`: every plan, archived and drafts included (the editor).
 */
export async function listPlans(
  db: Db,
  opts: { scope?: "published" | "all" } = {}
): Promise<Plan[]> {
  let q = db.selectFrom("plans_plans").selectAll()
  if ((opts.scope ?? "published") === "published")
    q = q
      .where("published", "=", true)
      .where("active", "=", true)
      .where("plan_ref", "is not", null)
  const rows = await q.orderBy("sort", "asc").orderBy("key", "asc").execute()
  return withEntitlements(db, rows)
}

async function lockPlan(trx: Trx, id: string): Promise<Selectable<PlansPlansTable>> {
  const row = await trx
    .selectFrom("plans_plans")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst()
  if (!row) throw new PlansError("not_found")
  return row
}

/** Maps pg constraint errors of a catalog write to codes the editor can show. */
function catalogError(err: unknown): unknown {
  if (err instanceof PlansError) return err
  if (isUniqueViolation(err)) {
    const c = String((err as { constraint?: unknown }).constraint ?? "")
    if (c.includes("plan_ref")) return new PlansError("ref_taken")
    if (c.includes("key")) return new PlansError("key_taken")
    return new PlansError("conflict")
  }
  if (isCheckViolation(err)) return new PlansError("conflict")
  return err
}

/** Creates a plan, unpublished and not default. Returns its id. */
export async function createPlan(db: Db, input: CreatePlan): Promise<string> {
  const id = randomUUID()
  try {
    await db.transaction().execute(async (trx) => {
      const [byKey, byRef] = await Promise.all([
        trx.selectFrom("plans_plans").select("id").where("key", "=", input.key).executeTakeFirst(),
        input.planRef
          ? trx.selectFrom("plans_plans").select("id").where("plan_ref", "=", input.planRef).executeTakeFirst()
          : Promise.resolve(undefined),
      ])
      if (byKey) throw new PlansError("key_taken")
      if (byRef) throw new PlansError("ref_taken")
      await trx
        .insertInto("plans_plans")
        .values({
          id,
          key: input.key,
          name_es: input.nameEs,
          name_en: input.nameEn,
          description_es: input.descriptionEs,
          description_en: input.descriptionEn,
          plan_ref: input.planRef,
          sort: input.sort,
          price_note_es: input.priceNoteEs,
          price_note_en: input.priceNoteEn,
          published: false,
          is_default: false,
          active: true,
        })
        .execute()
    })
  } catch (err) {
    throw catalogError(err)
  }
  return id
}

/**
 * Edits a plan's texts, order, informational price and `plan_ref`. A
 * PUBLISHED plan cannot lose its `plan_ref` (`ref_required`: unpublish it
 * first); a `plan_ref` used by another plan → `ref_taken`.
 */
export async function updatePlan(db: Db, input: UpdatePlan): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      const row = await lockPlan(trx, input.planId)
      if (row.published && !input.planRef) throw new PlansError("ref_required")
      if (input.planRef && input.planRef !== row.plan_ref) {
        const other = await trx
          .selectFrom("plans_plans")
          .select("id")
          .where("plan_ref", "=", input.planRef)
          .where("id", "!=", input.planId)
          .executeTakeFirst()
        if (other) throw new PlansError("ref_taken")
      }
      await trx
        .updateTable("plans_plans")
        .set({
          name_es: input.nameEs,
          name_en: input.nameEn,
          description_es: input.descriptionEs,
          description_en: input.descriptionEn,
          plan_ref: input.planRef,
          sort: input.sort,
          price_note_es: input.priceNoteEs,
          price_note_en: input.priceNoteEn,
          updated_at: new Date(),
        })
        .where("id", "=", input.planId)
        .execute()
    })
  } catch (err) {
    throw catalogError(err)
  }
}

/** Publish (needs `plan_ref` and not archived) or unpublish. Unpublishing never touches subscribers. */
export async function setPublished(db: Db, planId: string, published: boolean): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      const row = await lockPlan(trx, planId)
      if (published) {
        const blockers = publishBlockers({ active: row.active, planRef: row.plan_ref })
        if (blockers.includes("archived")) throw new PlansError("not_subscribable")
        if (blockers.includes("missing_plan_ref")) throw new PlansError("ref_required")
      }
      await trx
        .updateTable("plans_plans")
        .set({ published, updated_at: new Date() })
        .where("id", "=", planId)
        .execute()
    })
  } catch (err) {
    throw catalogError(err)
  }
}

/**
 * Archive (also unpublishes) or unarchive (stays unpublished until someone
 * publishes it again). Archiving the default plan needs `newDefaultPlanId`,
 * made default in the SAME transaction. Nothing is deleted and nobody loses a
 * plan they pay for: `findPlanByRef` still finds archived plans.
 */
export async function setArchived(
  db: Db,
  planId: string,
  archived: boolean,
  newDefaultPlanId: string | null
): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      const row = await lockPlan(trx, planId)
      const now = new Date()
      if (!archived) {
        await trx.updateTable("plans_plans").set({ active: true, updated_at: now }).where("id", "=", planId).execute()
        return
      }
      const replacement = row.is_default && newDefaultPlanId ? await lockPlan(trx, newDefaultPlanId) : null
      const problem = archiveProblem(
        { id: row.id, isDefault: row.is_default },
        replacement ? { id: replacement.id, active: replacement.active } : null
      )
      if (problem) throw new PlansError(problem)
      if (replacement) {
        // Order matters for the partial unique index: unset first, then set.
        await trx.updateTable("plans_plans").set({ is_default: false, updated_at: now }).where("id", "=", planId).execute()
        await trx.updateTable("plans_plans").set({ is_default: true, updated_at: now }).where("id", "=", replacement.id).execute()
      }
      await trx
        .updateTable("plans_plans")
        .set({ active: false, published: false, updated_at: now })
        .where("id", "=", planId)
        .execute()
    })
  } catch (err) {
    throw catalogError(err)
  }
}

/** Removes one entitlement from one plan (the plan stays). Missing → `not_found`. */
export async function removeEntitlement(db: Db, planId: string, key: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await lockPlan(trx, planId)
    const res = await trx
      .deleteFrom("plans_entitlements")
      .where("plan_id", "=", planId)
      .where("key", "=", key)
      .executeTakeFirst()
    if (Number(res.numDeletedRows) === 0) throw new PlansError("not_found")
    await trx.updateTable("plans_plans").set({ updated_at: new Date() }).where("id", "=", planId).execute()
  })
}

// ── Change / cancel requests (display only) ──────────────────────────────────

function toRequest(r: Selectable<PlansSubscriptionRequestsTable>): RequestSnapshot {
  return {
    kind: r.kind,
    subscriptionId: r.subscription_id,
    fromPlanRef: r.from_plan_ref,
    toPlanId: r.to_plan_id,
    toPlanRef: r.to_plan_ref,
    atPeriodEnd: r.at_period_end,
    requestedAt: r.requested_at,
  }
}

export async function getRequest(db: Db, subject: string): Promise<RequestSnapshot | null> {
  const row = await db
    .selectFrom("plans_subscription_requests")
    .selectAll()
    .where("subject", "=", subject)
    .executeTakeFirst()
  return row ? toRequest(row) : null
}

/** Remembers the last request of a subject (one row per subject, replaced). */
export async function saveRequest(
  db: Db,
  subject: string,
  req: Omit<RequestSnapshot, "requestedAt">
): Promise<void> {
  const values = {
    kind: req.kind,
    subscription_id: req.subscriptionId,
    from_plan_ref: req.fromPlanRef,
    to_plan_id: req.toPlanId,
    to_plan_ref: req.toPlanRef,
    at_period_end: req.atPeriodEnd,
    requested_at: new Date(),
  }
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("plans_subscription_requests")
      .values({ subject, ...values })
      .onConflict((oc) => oc.column("subject").doUpdateSet(values))
      .execute()
  })
}

/**
 * Upserts one entitlement. A key keeps ONE kind across the whole catalog
 * (`projects` cannot be a limit in one plan and a flag in another: `can` and
 * `limit` would disagree by plan), checked inside the transaction.
 */
export async function setEntitlement(db: Db, input: SetEntitlement): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const plan = await trx
      .selectFrom("plans_plans")
      .select("id")
      .where("id", "=", input.planId)
      .forUpdate()
      .executeTakeFirst()
    if (!plan) throw new PlansError("not_found")
    // Serialize writers of the same key, so two plans cannot race into two kinds.
    await sql`select pg_advisory_xact_lock(hashtext(${"plans_entitlements:" + input.key}))`.execute(trx)
    const other = await trx
      .selectFrom("plans_entitlements")
      .select("kind")
      .where("key", "=", input.key)
      .where("kind", "!=", input.kind)
      .executeTakeFirst()
    if (other) throw new PlansError("kind_mismatch")
    const now = new Date()
    await trx
      .insertInto("plans_entitlements")
      .values({
        id: randomUUID(),
        plan_id: input.planId,
        key: input.key,
        kind: input.kind,
        enabled: input.kind === "feature" ? input.enabled : false,
        limit_value: input.kind === "limit" ? input.limit : null,
        label_es: input.labelEs,
        label_en: input.labelEn,
      })
      .onConflict((oc) =>
        oc.columns(["plan_id", "key"]).doUpdateSet({
          kind: input.kind,
          enabled: input.kind === "feature" ? input.enabled : false,
          limit_value: input.kind === "limit" ? input.limit : null,
          label_es: input.labelEs,
          label_en: input.labelEn,
          updated_at: now,
        })
      )
      .execute()
    await trx
      .updateTable("plans_plans")
      .set({ updated_at: now })
      .where("id", "=", input.planId)
      .execute()
  })
}

/**
 * Makes `planId` the ONLY default plan, atomically: unset the old one and set
 * the new one in one transaction (partial unique index as backstop). An
 * archived plan cannot be the default (`default_archived`). A concurrent
 * change → `conflict`.
 */
export async function setDefaultPlan(db: Db, planId: string): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      const target = await lockPlan(trx, planId)
      const problem = defaultProblem({ active: target.active })
      if (problem) throw new PlansError(problem)
      const now = new Date()
      await trx
        .updateTable("plans_plans")
        .set({ is_default: false, updated_at: now })
        .where("is_default", "=", true)
        .where("id", "!=", planId)
        .execute()
      const res = await trx
        .updateTable("plans_plans")
        .set({ is_default: true, updated_at: now })
        .where("id", "=", planId)
        .executeTakeFirst()
      if (Number(res.numUpdatedRows) === 0) throw new PlansError("not_found")
    })
  } catch (err) {
    if (err instanceof PlansError) throw err
    if (isUniqueViolation(err) || isCheckViolation(err)) throw new PlansError("conflict")
    throw err
  }
}
