import { getKysely } from "@/server/db/pool"

import {
  isTicketPriority,
  isTicketStatus,
  type AuthorKind,
  type TicketPriority,
  type TicketStatus,
} from "../contracts/domain"
import "../db/types"

/** Read-only data access. Callers decide who may see what (see `canView`). */
export const LIST_LIMIT = 200

export type TicketRow = {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  requesterId: string
  requesterName: string | null
  createdAt: Date
  updatedAt: Date
}

export type MessageRow = {
  id: string
  authorId: string
  authorName: string | null
  authorKind: AuthorKind
  body: string
  createdAt: Date
}

function base() {
  return getKysely()
    .selectFrom("tickets as t")
    .leftJoin("user as u", "u.id", "t.requester_id")
    .select([
      "t.id",
      "t.subject",
      "t.status",
      "t.priority",
      "t.requester_id",
      "u.name as requester_name",
      "t.created_at",
      "t.updated_at",
    ])
}

type Raw = {
  id: string
  subject: string
  status: string
  priority: string
  requester_id: string
  requester_name: string | null
  created_at: Date
  updated_at: Date
}

function toRow(r: Raw): TicketRow {
  return {
    id: r.id,
    subject: r.subject,
    status: isTicketStatus(r.status) ? r.status : "open",
    priority: isTicketPriority(r.priority) ? r.priority : "normal",
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** The person's own tickets, most recently touched first. */
export async function listMine(userId: string): Promise<TicketRow[]> {
  const rows = await base()
    .where("t.requester_id", "=", userId)
    .orderBy("t.updated_at", "desc")
    .limit(LIST_LIMIT)
    .execute()
  return rows.map(toRow)
}

/** Every ticket (staff), optionally of one status. Caller checks `ticket:manage`. */
export async function listAll(status?: TicketStatus): Promise<TicketRow[]> {
  let q = base()
  if (status) q = q.where("t.status", "=", status)
  const rows = await q.orderBy("t.updated_at", "desc").limit(LIST_LIMIT).execute()
  return rows.map(toRow)
}

export async function getTicket(id: string): Promise<TicketRow | null> {
  const row = await base().where("t.id", "=", id).executeTakeFirst()
  return row ? toRow(row) : null
}

export async function listMessages(ticketId: string): Promise<MessageRow[]> {
  const rows = await getKysely()
    .selectFrom("tickets_messages as m")
    .leftJoin("user as u", "u.id", "m.author_id")
    .select(["m.id", "m.author_id", "u.name as author_name", "m.author_kind", "m.body", "m.created_at"])
    .where("m.ticket_id", "=", ticketId)
    .orderBy("m.created_at", "asc")
    .orderBy("m.id", "asc")
    .execute()
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorKind: r.author_kind === "staff" ? "staff" : "requester",
    body: r.body,
    createdAt: r.created_at,
  }))
}
