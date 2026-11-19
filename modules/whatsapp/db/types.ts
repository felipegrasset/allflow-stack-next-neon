import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

/** One row per phone number with a recorded consent. No row = no consent. */
export interface WhatsappOptinsTable {
  /** E.164 with the leading + (server/phone.ts). */
  phone: string
  status: "opted_in" | "opted_out"
  user_id: string | null
  source: "form" | "keyword" | "admin" | "api"
  /** What proves the consent (form and text version, import batch…). No personal data. */
  evidence: string | null
  opted_in_at: Date | null
  opted_out_at: Date | null
  created_at: Timestamp
  updated_at: Timestamp
}

/** Every message, both directions, and every send that was blocked. */
export interface WhatsappMessagesTable {
  id: string
  direction: "outbound" | "inbound"
  phone: string
  kind: "text" | "template" | "other"
  template_name: string | null
  template_lang: string | null
  /** Free text (personal data). Null for templates, media and blocked sends. */
  body: string | null
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "blocked" | "received"
  provider: string | null
  provider_message_id: string | null
  error_code: string | null
  idempotency_key: string | null
  user_id: string | null
  sent_by: string | null
  /** Inbound: when the person sent it (provider timestamp, never in the future). */
  created_at: Timestamp
  updated_at: Timestamp
}

/** Interface merging: adds the tables to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    whatsapp_optins: WhatsappOptinsTable
    whatsapp_messages: WhatsappMessagesTable
  }
}
