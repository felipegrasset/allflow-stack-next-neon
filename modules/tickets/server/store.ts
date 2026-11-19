/**
 * Database side. Every function takes `db` (injected) and the already
 * resolved viewer. Kysely only. State changes lock the ticket row and
 * re-apply the pure rules of contracts/domain.ts inside the transaction.
 */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  isTicketStatus,
  planReply,
  planStatusChange,
  type AuthorKind,
  type TicketStatus,
  type Viewer,
} from "../contracts/domain"
import type { CreateTicketInput } from "../contracts/input"
import "../db/types"

type Db = Kysely<Database>

export type StoreFailure = "not_found" | "closed" | "invalid_transition" | "same_status"

export async function createTicketWith(
  db: Db,
  requesterId: string,
  input: CreateTicketInput & { entity?: string; entityId?: string }
): Promise<{ ticketId: string; messageId: string }> {
  const ticketId = randomUUID()
  const messageId = randomUUID()
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("tickets")
      .values({
        id: ticketId,
        subject: input.subject,
        priority: input.priority,
        requester_id: requesterId,
        entity: input.entity ?? null,
        entity_id: input.entityId ?? null,
      })
      .execute()
    await trx
      .insertInto("tickets_messages")
      .values({
        id: messageId,
        ticket_id: ticketId,
        author_id: requesterId,
        author_kind: "requester",
        body: input.body,
      })
      .execute()
  })
  return { ticketId, messageId }
}

export type ReplyOk = {
  ok: true
  messageId: string
  kind: AuthorKind
  subject: string
  requesterId: string
  status: TicketStatus
}

export async function addMessageWith(
  db: Db,
  viewer: Viewer,
  ticketId: string,
  body: string
): Promise<ReplyOk | { ok: false; reason: StoreFailure }> {
  return db.transaction().execute(async (trx) => {
    const t = await trx
      .selectFrom("tickets")
      .select(["id", "subject", "status", "requester_id"])
      .where("id", "=", ticketId)
      .forUpdate()
      .executeTakeFirst()
    if (!t || !isTicketStatus(t.status)) return { ok: false as const, reason: "not_found" as const }
    const plan = planReply({ requesterId: t.requester_id, status: t.status }, viewer)
    if (!plan.ok) return { ok: false as const, reason: plan.reason }

    const messageId = randomUUID()
    const now = new Date()
    await trx
      .insertInto("tickets_messages")
      .values({
        id: messageId,
        ticket_id: t.id,
        author_id: viewer.userId,
        author_kind: plan.kind,
        body,
      })
      .execute()
    await trx
      .updateTable("tickets")
      .set({ status: plan.nextStatus, updated_at: now, closed_at: null })
      .where("id", "=", t.id)
      .execute()
    return {
      ok: true as const,
      messageId,
      kind: plan.kind,
      subject: t.subject,
      requesterId: t.requester_id,
      status: plan.nextStatus,
    }
  })
}

export type StatusOk = { ok: true; subject: string; requesterId: string; status: TicketStatus }

export async function changeStatusWith(
  db: Db,
  viewer: Viewer,
  ticketId: string,
  to: TicketStatus
): Promise<StatusOk | { ok: false; reason: StoreFailure }> {
  return db.transaction().execute(async (trx) => {
    const t = await trx
      .selectFrom("tickets")
      .select(["id", "subject", "status", "requester_id"])
      .where("id", "=", ticketId)
      .forUpdate()
      .executeTakeFirst()
    if (!t || !isTicketStatus(t.status)) return { ok: false as const, reason: "not_found" as const }
    const plan = planStatusChange({ requesterId: t.requester_id, status: t.status }, to, viewer)
    if (!plan.ok) return { ok: false as const, reason: plan.reason }
    const now = new Date()
    await trx
      .updateTable("tickets")
      .set({ status: to, updated_at: now, closed_at: plan.closes ? now : null })
      .where("id", "=", t.id)
      .execute()
    return { ok: true as const, subject: t.subject, requesterId: t.requester_id, status: to }
  })
}
