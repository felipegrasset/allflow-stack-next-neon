/**
 * Data access of the discounts module. Callers check permissions first (the
 * Server Actions do). Reads for the admin list and the redemption history;
 * code writes (create, update, activate). The redemption writes live in
 * server/redeem.ts, under row locks.
 */
import { randomUUID } from "node:crypto"

import { sql, type Kysely, type Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import type { CodeData } from "../contracts/input"
import {
  DiscountError,
  type DiscountCode,
  type DiscountCodeWithUses,
  type DiscountKind,
  type Redemption,
  type ReleaseReason,
} from "../contracts/types"
import type { DiscountsCodesTable, DiscountsRedemptionsTable } from "../db/types"

export type Db = Kysely<Database>

const num = (v: string | number | null): number | null => (v === null ? null : Number(v))

export function toCode(r: Selectable<DiscountsCodesTable>): DiscountCode {
  return {
    id: r.id,
    code: r.code,
    kind: r.kind as DiscountKind,
    percentBp: r.percent_bp,
    amountMinor: num(r.amount_minor),
    currency: r.currency,
    minSubtotalMinor: num(r.min_subtotal_minor),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    maxUses: r.max_uses,
    maxUsesPerUser: r.max_uses_per_user,
    active: r.active,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function toRedemption(r: Selectable<DiscountsRedemptionsTable>): Redemption {
  return {
    id: r.id,
    codeId: r.code_id,
    code: r.code,
    orderId: r.order_id,
    userId: r.user_id,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    subtotalMinor: Number(r.subtotal_minor),
    createdAt: r.created_at,
    releasedAt: r.released_at,
    releaseReason: r.release_reason as ReleaseReason | null,
    confirmedAt: r.confirmed_at,
  }
}

/** Every code with its active uses, newest first (max 200). */
export async function listCodes(db: Db): Promise<DiscountCodeWithUses[]> {
  const rows = await db
    .selectFrom("discounts_codes as c")
    .selectAll("c")
    .select((eb) =>
      eb
        .selectFrom("discounts_redemptions as r")
        .select(sql<string>`count(*)`.as("n"))
        .whereRef("r.code_id", "=", "c.id")
        .where("r.released_at", "is", null)
        .as("active_uses")
    )
    .orderBy("c.created_at", "desc")
    .orderBy("c.id", "desc")
    .limit(200)
    .execute()
  return rows.map((r) => ({ ...toCode(r), activeUses: Number(r.active_uses ?? 0) }))
}

export async function getCode(db: Db, id: string): Promise<DiscountCode | null> {
  const r = await db.selectFrom("discounts_codes").selectAll().where("id", "=", id).executeTakeFirst()
  return r ? toCode(r) : null
}

/** The latest uses of a code (active and released), newest first. */
export async function listRedemptions(db: Db, codeId: string, limit = 50): Promise<Redemption[]> {
  const rows = await db
    .selectFrom("discounts_redemptions")
    .selectAll()
    .where("code_id", "=", codeId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(Math.min(Math.max(limit, 1), 200))
    .execute()
  return rows.map(toRedemption)
}

/** The active use of an order, if any. */
export async function activeRedemption(db: Db, orderId: string): Promise<Redemption | null> {
  const r = await db
    .selectFrom("discounts_redemptions")
    .selectAll()
    .where("order_id", "=", orderId)
    .where("released_at", "is", null)
    .executeTakeFirst()
  return r ? toRedemption(r) : null
}

const columns = (d: CodeData) => ({
  kind: d.kind,
  percent_bp: d.kind === "percent" ? d.percentBp : null,
  amount_minor: d.kind === "fixed" ? d.amountMinor : null,
  currency: d.currency,
  min_subtotal_minor: d.minSubtotalMinor,
  starts_at: d.startsAt,
  ends_at: d.endsAt,
  max_uses: d.maxUses,
  max_uses_per_user: d.maxUsesPerUser,
  note: d.note,
})

/**
 * Creates a code (already normalised). A taken code → `code_taken`, detected
 * with `on conflict do nothing` (no error caught inside a transaction).
 */
export async function createCode(
  db: Db,
  input: { code: string; active: boolean; data: CodeData; createdBy: string | null }
): Promise<string> {
  const id = randomUUID()
  const row = await db
    .insertInto("discounts_codes")
    .values({ id, code: input.code, active: input.active, created_by: input.createdBy, ...columns(input.data) })
    .onConflict((oc) => oc.column("code").doNothing())
    .returning("id")
    .executeTakeFirst()
  if (!row) throw new DiscountError("code_taken")
  return row.id
}

/**
 * Edits a code's rule. The code text never changes (it may be printed
 * somewhere). Uses already made keep the amount they got; the new rule
 * applies from the next redemption. Lowering a cap below the active uses is
 * allowed: no new use until uses drop below it.
 */
export async function updateCode(db: Db, codeId: string, data: CodeData): Promise<void> {
  const r = await db
    .updateTable("discounts_codes")
    .set({ ...columns(data), updated_at: new Date() })
    .where("id", "=", codeId)
    .executeTakeFirst()
  if (Number(r.numUpdatedRows) === 0) throw new DiscountError("not_found")
}

export async function setActive(db: Db, codeId: string, active: boolean): Promise<void> {
  const r = await db
    .updateTable("discounts_codes")
    .set({ active, updated_at: new Date() })
    .where("id", "=", codeId)
    .executeTakeFirst()
  if (Number(r.numUpdatedRows) === 0) throw new DiscountError("not_found")
}
