import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
/** jsonb: read back as parsed JSON (validated again with zod), written as a JSON string. */
type Json = ColumnType<unknown, string, string>

export interface SettingsTable {
  key: string
  value: Json
  /** User id, no foreign key on purpose: the value outlives the user. Null when changed without a session. */
  updated_by: string | null
  updated_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    settings: SettingsTable
  }
}
