/**
 * The data the send / consent / inbound logic needs, behind an interface so
 * the tests run it against memory (tests/whatsapp.test.ts) and the app against
 * Postgres (`kyselyStore`). Every write that must not happen twice is atomic
 * here (insert … on conflict do nothing), not in the caller.
 */
import type { Kysely, Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import type {
  Consent,
  ConsentSource,
  MessageStatus,
  WhatsAppMessage,
} from "../contracts/types"
import type { WhatsappMessagesTable, WhatsappOptinsTable } from "../db/types"

export type NewMessage = Omit<WhatsAppMessage, "createdAt"> & {
  idempotencyKey: string | null
  createdAt?: Date
}

export type ConsentWrite = {
  phone: string
  status: "opted_in" | "opted_out"
  source: ConsentSource
  userId?: string | null
  evidence?: string | null
  at: Date
}

export interface WhatsAppStore {
  getConsent(phone: string): Promise<Consent>
  /** Upsert. The caller (consent.ts) decides whether the change is allowed. */
  writeConsent(w: ConsentWrite): Promise<void>
  /** Last inbound message of the number, for the 24 h window. */
  lastInboundAt(phone: string): Promise<Date | null>
  findByIdempotencyKey(key: string): Promise<WhatsAppMessage | null>
  /**
   * Inserts the row; false if its idempotency key or (provider,
   * providerMessageId) already exists (nothing written).
   */
  insertMessage(m: NewMessage): Promise<boolean>
  updateMessage(
    id: string,
    patch: { status: MessageStatus; providerMessageId?: string | null; errorCode?: string | null }
  ): Promise<void>
  /**
   * Status receipt for an outbound message. Moves forward only (sent →
   * delivered → read; failed from any non-final state) and returns the row
   * if it changed, null otherwise (unknown id, repeated or older receipt).
   */
  applyReceipt(
    provider: string,
    providerMessageId: string,
    status: "sent" | "delivered" | "read" | "failed",
    errorCode: string | null
  ): Promise<WhatsAppMessage | null>
  listMessages(q: { phone?: string; limit: number }): Promise<WhatsAppMessage[]>
  listConsents(q: { limit: number }): Promise<Consent[]>
  /** Deletes every row of the number (messages and consent). Returns how many messages. */
  forget(phone: string): Promise<number>
}

/** Which receipt may replace which status. `failed` and `read` are final. */
export const RECEIPT_FROM: Record<"sent" | "delivered" | "read" | "failed", MessageStatus[]> = {
  sent: ["pending"],
  delivered: ["pending", "sent"],
  read: ["pending", "sent", "delivered"],
  failed: ["pending", "sent", "delivered"],
}

export function toMessage(r: Selectable<WhatsappMessagesTable>): WhatsAppMessage {
  return {
    id: r.id,
    direction: r.direction,
    phone: r.phone,
    kind: r.kind,
    templateName: r.template_name,
    templateLang: r.template_lang,
    body: r.body,
    status: r.status,
    provider: r.provider,
    providerMessageId: r.provider_message_id,
    errorCode: r.error_code,
    userId: r.user_id,
    sentBy: r.sent_by,
    createdAt: new Date(r.created_at),
  }
}

export function toConsent(r: Selectable<WhatsappOptinsTable>): Consent {
  return {
    phone: r.phone,
    status: r.status,
    userId: r.user_id,
    source: r.source,
    optedInAt: r.opted_in_at ? new Date(r.opted_in_at) : null,
    optedOutAt: r.opted_out_at ? new Date(r.opted_out_at) : null,
  }
}

const noConsent = (phone: string): Consent => ({
  phone,
  status: "none",
  userId: null,
  source: null,
  optedInAt: null,
  optedOutAt: null,
})

export function kyselyStore(db: Kysely<Database>): WhatsAppStore {
  return {
    async getConsent(phone) {
      const r = await db
        .selectFrom("whatsapp_optins")
        .selectAll()
        .where("phone", "=", phone)
        .executeTakeFirst()
      return r ? toConsent(r) : noConsent(phone)
    },

    async writeConsent(w) {
      const optedIn = w.status === "opted_in"
      await db
        .insertInto("whatsapp_optins")
        .values({
          phone: w.phone,
          status: w.status,
          source: w.source,
          user_id: w.userId ?? null,
          evidence: w.evidence ?? null,
          opted_in_at: optedIn ? w.at : null,
          opted_out_at: optedIn ? null : w.at,
          updated_at: w.at,
        })
        .onConflict((oc) =>
          oc.column("phone").doUpdateSet((eb) => ({
            status: w.status,
            source: w.source,
            // Keep the known user / evidence when this write brings none.
            user_id: w.userId ?? eb.ref("whatsapp_optins.user_id"),
            evidence: w.evidence ?? eb.ref("whatsapp_optins.evidence"),
            opted_in_at: optedIn ? w.at : eb.ref("whatsapp_optins.opted_in_at"),
            opted_out_at: optedIn ? eb.ref("whatsapp_optins.opted_out_at") : w.at,
            updated_at: w.at,
          }))
        )
        .execute()
    },

    async lastInboundAt(phone) {
      const r = await db
        .selectFrom("whatsapp_messages")
        .select("created_at")
        .where("phone", "=", phone)
        .where("direction", "=", "inbound")
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst()
      return r ? new Date(r.created_at) : null
    },

    async findByIdempotencyKey(key) {
      const r = await db
        .selectFrom("whatsapp_messages")
        .selectAll()
        .where("idempotency_key", "=", key)
        .executeTakeFirst()
      return r ? toMessage(r) : null
    },

    async insertMessage(m) {
      const row = await db
        .insertInto("whatsapp_messages")
        .values({
          id: m.id,
          direction: m.direction,
          phone: m.phone,
          kind: m.kind,
          template_name: m.templateName,
          template_lang: m.templateLang,
          body: m.body,
          status: m.status,
          provider: m.provider,
          provider_message_id: m.providerMessageId,
          error_code: m.errorCode,
          idempotency_key: m.idempotencyKey,
          user_id: m.userId,
          sent_by: m.sentBy,
          ...(m.createdAt ? { created_at: m.createdAt } : {}),
        })
        .onConflict((oc) => oc.doNothing())
        .returning("id")
        .executeTakeFirst()
      return !!row
    },

    async updateMessage(id, patch) {
      await db
        .updateTable("whatsapp_messages")
        .set({
          status: patch.status,
          ...(patch.providerMessageId !== undefined
            ? { provider_message_id: patch.providerMessageId }
            : {}),
          ...(patch.errorCode !== undefined ? { error_code: patch.errorCode } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute()
    },

    async applyReceipt(provider, providerMessageId, status, errorCode) {
      const r = await db
        .updateTable("whatsapp_messages")
        .set({
          status,
          ...(status === "failed" ? { error_code: errorCode ?? "failed" } : {}),
          updated_at: new Date(),
        })
        .where("provider", "=", provider)
        .where("provider_message_id", "=", providerMessageId)
        .where("direction", "=", "outbound")
        .where("status", "in", RECEIPT_FROM[status])
        .returningAll()
        .executeTakeFirst()
      return r ? toMessage(r) : null
    },

    async listMessages({ phone, limit }) {
      let q = db.selectFrom("whatsapp_messages").selectAll()
      if (phone) q = q.where("phone", "=", phone)
      const rows = await q.orderBy("created_at", "desc").limit(limit).execute()
      return rows.map(toMessage)
    },

    async listConsents({ limit }) {
      const rows = await db
        .selectFrom("whatsapp_optins")
        .selectAll()
        .orderBy("updated_at", "desc")
        .limit(limit)
        .execute()
      return rows.map(toConsent)
    },

    async forget(phone) {
      return db.transaction().execute(async (trx) => {
        const res = await trx
          .deleteFrom("whatsapp_messages")
          .where("phone", "=", phone)
          .executeTakeFirst()
        await trx.deleteFrom("whatsapp_optins").where("phone", "=", phone).execute()
        return Number(res.numDeletedRows ?? 0)
      })
    },
  }
}
