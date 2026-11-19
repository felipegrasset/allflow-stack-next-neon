import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, never>
/** jsonb: read back parsed (re-validated by the UI), written as a JSON string. Never updated. */
type Json = ColumnType<unknown, string | null | undefined, never>

/** Append-only: no column is ever updated (a trigger rejects it). */
export interface AuditLogTable {
  id: string
  /** Null for system actions. No foreign key: history outlives the user. */
  actor_id: ColumnType<string | null, string | null | undefined, never>
  /** Name of the actor when it was recorded. */
  actor_name: ColumnType<string | null, string | null | undefined, never>
  action: ColumnType<string, string, never>
  entity: ColumnType<string, string, never>
  entity_id: ColumnType<string, string, never>
  diff: Json
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    audit_log: AuditLogTable
  }
}
