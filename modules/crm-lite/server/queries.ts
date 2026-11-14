import { getKysely } from "@/server/db/pool"

import {
  isDealStage,
  likePattern,
  type Activity,
  type BoardDeal,
  type Contact,
} from "../contracts/domain"
import "../db/types"

/** Read-only data access. Callers check `contact:read` / `deal:read` first. */

export const BOARD_LIMIT = 500
export const CONTACTS_LIMIT = 200

/** Every deal for the board (most recently touched first, capped at BOARD_LIMIT). */
export async function listBoardDeals(): Promise<BoardDeal[]> {
  const rows = await getKysely()
    .selectFrom("crm_lite_deals as d")
    .innerJoin("crm_lite_contacts as c", "c.id", "d.contact_id")
    .select([
      "d.id",
      "d.contact_id",
      "d.name",
      "d.amount_minor",
      "d.currency",
      "d.stage",
      "c.name as contact_name",
      "c.company as contact_company",
    ])
    .orderBy("d.updated_at", "desc")
    .limit(BOARD_LIMIT)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    name: r.name,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    stage: r.stage,
    contactName: r.contact_name,
    contactCompany: r.contact_company,
  }))
}

/** Contacts, optionally filtered by name, email or company (case-insensitive, literal match). */
export async function listContacts(search?: string): Promise<Contact[]> {
  let q = getKysely()
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
  const term = search?.trim()
  if (term) {
    const pattern = likePattern(term)
    q = q.where((eb) =>
      eb.or([
        eb("name", "ilike", pattern),
        eb("email", "ilike", pattern),
        eb("company", "ilike", pattern),
      ])
    )
  }
  const rows = await q
    .orderBy("updated_at", "desc")
    .limit(CONTACTS_LIMIT)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    status: r.status,
    notes: r.notes,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }))
}

/** The timeline of a contact, newest first. */
export async function listActivities(
  contactId: string,
  limit = 100
): Promise<Activity[]> {
  const rows = await getKysely()
    .selectFrom("crm_lite_activities as a")
    .leftJoin("crm_lite_deals as d", "d.id", "a.deal_id")
    .leftJoin("user as u", "u.id", "a.author_id")
    .select([
      "a.id",
      "a.contact_id",
      "a.deal_id",
      "a.kind",
      "a.body",
      "a.from_stage",
      "a.to_stage",
      "a.created_at",
      "d.name as deal_name",
      "u.name as author_name",
    ])
    .where("a.contact_id", "=", contactId)
    .orderBy("a.created_at", "desc")
    .limit(limit)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    dealId: r.deal_id,
    dealName: r.deal_name,
    kind: r.kind,
    body: r.body,
    fromStage: isDealStage(r.from_stage) ? r.from_stage : null,
    toStage: isDealStage(r.to_stage) ? r.to_stage : null,
    authorName: r.author_name,
    createdAt: new Date(r.created_at),
  }))
}
