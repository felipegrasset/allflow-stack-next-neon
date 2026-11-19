import { randomUUID } from "node:crypto"

import { sql } from "kysely"

import { getKysely } from "@/server/db/pool"

import {
  planMove,
  type Contact,
  type ContactStatus,
  type Deal,
  type DealStage,
} from "../contracts/domain"
import {
  logActivitySchema,
  upsertContactSchema,
  type ActivityInput,
  type ContactInput,
  type DealInput,
  type LogActivityInput,
  type UpsertContactInput,
} from "../contracts/input"
import { parseAmount } from "../contracts/money"
import "../db/types"

/**
 * Data access that writes. No permission checks here: the Server Actions
 * (actions.ts) check them, and the contracts are for trusted server code.
 */

const nullIfEmpty = (s: string | undefined): string | null =>
  s === undefined || s.trim() === "" ? null : s.trim()

/** Postgres unique_violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  )
}

// ── contacts ────────────────────────────────────────────────────────────────

export async function createContact(
  input: ContactInput,
  ownerId: string
): Promise<string> {
  const id = randomUUID()
  await getKysely()
    .insertInto("crm_lite_contacts")
    .values({
      id,
      name: input.name,
      email: nullIfEmpty(input.email)?.toLowerCase() ?? null,
      phone: nullIfEmpty(input.phone),
      company: nullIfEmpty(input.company),
      status: input.status,
      notes: nullIfEmpty(input.notes),
      owner_id: ownerId,
    })
    .execute()
  return id
}

/** false when the contact does not exist. */
export async function updateContact(
  id: string,
  input: ContactInput
): Promise<boolean> {
  const res = await getKysely()
    .updateTable("crm_lite_contacts")
    .set({
      name: input.name,
      email: nullIfEmpty(input.email)?.toLowerCase() ?? null,
      phone: nullIfEmpty(input.phone),
      company: nullIfEmpty(input.company),
      status: input.status,
      notes: nullIfEmpty(input.notes),
      updated_at: sql<Date>`now()`,
    })
    .where("id", "=", id)
    .executeTakeFirst()
  return Number(res.numUpdatedRows) > 0
}

/**
 * Contract: creates a contact, or — when `email` matches an existing one —
 * fills in its empty fields. Never overwrites what the team typed and never
 * moves a customer back to lead. Throws ZodError on invalid input.
 */
export async function upsertContact(
  raw: UpsertContactInput
): Promise<{ id: string; created: boolean }> {
  const input = upsertContactSchema.parse(raw)
  const db = getKysely()
  const values = {
    name: input.name,
    email: input.email ?? null,
    phone: nullIfEmpty(input.phone),
    company: nullIfEmpty(input.company),
    status: (input.status ?? "lead") as ContactStatus,
  }
  if (!values.email) {
    const id = randomUUID()
    await db.insertInto("crm_lite_contacts").values({ id, ...values }).execute()
    return { id, created: true }
  }
  const newId = randomUUID()
  const row = await db
    .insertInto("crm_lite_contacts")
    .values({ id: newId, ...values })
    .onConflict((oc) =>
      oc
        .column("email")
        .where("email", "is not", null)
        .doUpdateSet({
          phone: sql<string | null>`coalesce(crm_lite_contacts.phone, excluded.phone)`,
          company: sql<
            string | null
          >`coalesce(crm_lite_contacts.company, excluded.company)`,
          status: sql<ContactStatus>`case when excluded.status = 'customer' then 'customer' else crm_lite_contacts.status end`,
          updated_at: sql<Date>`now()`,
        })
    )
    .returning("id")
    .executeTakeFirstOrThrow()
  return { id: row.id, created: row.id === newId }
}

/** Contract: one contact, or null. */
export async function getContact(id: string): Promise<Contact | null> {
  const r = await getKysely()
    .selectFrom("crm_lite_contacts")
    .select([
      "id",
      "name",
      "email",
      "phone",
      "company",
      "status",
      "notes",
      "created_at",
      "updated_at",
    ])
    .where("id", "=", id)
    .executeTakeFirst()
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    status: r.status,
    notes: r.notes,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

/** Contract: the deals of a contact, newest activity first. */
export async function listContactDeals(contactId: string): Promise<Deal[]> {
  const rows = await getKysely()
    .selectFrom("crm_lite_deals")
    .select([
      "id",
      "contact_id",
      "name",
      "amount_minor",
      "currency",
      "stage",
      "closed_at",
      "updated_at",
    ])
    .where("contact_id", "=", contactId)
    .orderBy("updated_at", "desc")
    .limit(200)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    name: r.name,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    stage: r.stage,
    closedAt: r.closed_at ? new Date(r.closed_at) : null,
    updatedAt: new Date(r.updated_at),
  }))
}

// ── deals ───────────────────────────────────────────────────────────────────

/** null when the contact does not exist. */
export async function createDeal(
  contactId: string,
  input: DealInput,
  ownerId: string
): Promise<string | null> {
  const amountMinor =
    input.amount === "" ? 0 : parseAmount(input.amount, input.currency)
  if (amountMinor === null) throw new Error("crm-lite: invalid amount")
  const db = getKysely()
  return db.transaction().execute(async (trx) => {
    const contact = await trx
      .selectFrom("crm_lite_contacts")
      .select("id")
      .where("id", "=", contactId)
      .executeTakeFirst()
    if (!contact) return null
    const id = randomUUID()
    const closed = input.stage === "won" || input.stage === "lost"
    await trx
      .insertInto("crm_lite_deals")
      .values({
        id,
        contact_id: contactId,
        name: input.name,
        amount_minor: amountMinor,
        currency: input.currency,
        stage: input.stage,
        owner_id: ownerId,
        closed_at: closed ? sql<Date>`now()` : null,
      })
      .execute()
    if (input.stage === "won")
      await trx
        .updateTable("crm_lite_contacts")
        .set({ status: "customer", updated_at: sql<Date>`now()` })
        .where("id", "=", contactId)
        .where("status", "=", "lead")
        .execute()
    return id
  })
}

export type MoveResult =
  | { ok: true; contactId: string | null }
  | { ok: false; reason: "not_found" | "conflict" }

/**
 * Moves a deal from `from` to `to`. Optimistic concurrency: the UPDATE only
 * matches while the deal is still in `from`, so two people moving the same
 * card at once cannot both win (the second one gets `conflict`). The stage
 * change is logged as an activity in the same transaction; a won deal promotes
 * its contact to customer.
 */
export async function moveDeal(
  id: string,
  from: DealStage,
  to: DealStage,
  authorId: string
): Promise<MoveResult> {
  const plan = planMove(from, to)
  if (!plan) return { ok: true, contactId: null }
  return getKysely()
    .transaction()
    .execute(async (trx) => {
      const row = await trx
        .updateTable("crm_lite_deals")
        .set({
          stage: plan.stage,
          closed_at: plan.closeNow ? sql<Date>`now()` : null,
          updated_at: sql<Date>`now()`,
        })
        .where("id", "=", id)
        .where("stage", "=", from)
        .returning("contact_id")
        .executeTakeFirst()
      if (!row) {
        const exists = await trx
          .selectFrom("crm_lite_deals")
          .select("id")
          .where("id", "=", id)
          .executeTakeFirst()
        return { ok: false as const, reason: exists ? "conflict" : "not_found" }
      }
      await trx
        .insertInto("crm_lite_activities")
        .values({
          id: randomUUID(),
          contact_id: row.contact_id,
          deal_id: id,
          kind: "stage_change",
          from_stage: from,
          to_stage: to,
          author_id: authorId,
        })
        .execute()
      if (plan.promoteContact)
        await trx
          .updateTable("crm_lite_contacts")
          .set({ status: "customer", updated_at: sql<Date>`now()` })
          .where("id", "=", row.contact_id)
          .where("status", "=", "lead")
          .execute()
      return { ok: true as const, contactId: row.contact_id }
    })
}

// ── activities ──────────────────────────────────────────────────────────────

/**
 * Inserts a manual activity. A `dealId` that is not a deal of this contact is
 * rejected (returns null) — never linked across contacts. null also when the
 * contact does not exist.
 */
async function insertActivity(
  contactId: string,
  input: { kind: ActivityInput["kind"]; body: string; dealId: string | null },
  authorId: string | null
): Promise<string | null> {
  const db = getKysely()
  const contact = await db
    .selectFrom("crm_lite_contacts")
    .select("id")
    .where("id", "=", contactId)
    .executeTakeFirst()
  if (!contact) return null
  if (input.dealId) {
    const deal = await db
      .selectFrom("crm_lite_deals")
      .select("id")
      .where("id", "=", input.dealId)
      .where("contact_id", "=", contactId)
      .executeTakeFirst()
    if (!deal) return null
  }
  const id = randomUUID()
  await db
    .insertInto("crm_lite_activities")
    .values({
      id,
      contact_id: contactId,
      deal_id: input.dealId,
      kind: input.kind,
      body: input.body,
      author_id: authorId,
    })
    .execute()
  await db
    .updateTable("crm_lite_contacts")
    .set({ updated_at: sql<Date>`now()` })
    .where("id", "=", contactId)
    .execute()
  return id
}

export function createActivity(
  contactId: string,
  input: ActivityInput,
  authorId: string
): Promise<string | null> {
  return insertActivity(
    contactId,
    { kind: input.kind, body: input.body, dealId: input.dealId || null },
    authorId
  )
}

/** Contract: logs a note/call/email/meeting. Throws ZodError on invalid input; null if the contact (or deal) does not match. */
export async function logActivity(
  raw: LogActivityInput
): Promise<{ id: string } | null> {
  const input = logActivitySchema.parse(raw)
  const id = await insertActivity(
    input.contactId,
    { kind: input.kind, body: input.body, dealId: input.dealId ?? null },
    input.authorId ?? null
  )
  return id ? { id } : null
}
