import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>

export interface CalendarSyncAccountsTable {
  user_id: string
  status: ColumnType<"connected" | "disconnected", "connected" | "disconnected" | undefined, "connected" | "disconnected">
  disconnect_reason: "user" | "revoked" | "scope" | null
  scopes: Generated<string>
  calendar_id: Generated<string>
  /** AES-256-GCM ciphertext (server/crypto.ts), never the token. */
  access_token_enc: string | null
  access_expires_at: NullableTimestamp
  /** AES-256-GCM ciphertext (server/crypto.ts), never the token. */
  refresh_token_enc: string | null
  connected_at: Timestamp
  updated_at: Timestamp
}

export interface CalendarSyncStatesTable {
  nonce: string
  user_id: string
  verifier_enc: string
  expires_at: Timestamp
  created_at: Timestamp
}

export interface CalendarSyncEventsTable {
  booking_id: string
  user_id: string
  event_id: string
  calendar_id: Generated<string>
  desired: "confirmed" | "cancelled"
  state: ColumnType<
    "pending" | "synced" | "failed" | "skipped",
    "pending" | "synced" | "failed" | "skipped" | undefined,
    "pending" | "synced" | "failed" | "skipped"
  >
  fingerprint: string
  starts_at: Timestamp
  ends_at: Timestamp
  summary: string
  timezone: string
  attempts: Generated<number>
  last_error: string | null
  next_attempt_at: NullableTimestamp
  synced_at: NullableTimestamp
  updated_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    calendar_sync_accounts: CalendarSyncAccountsTable
    calendar_sync_states: CalendarSyncStatesTable
    calendar_sync_events: CalendarSyncEventsTable
  }
}
