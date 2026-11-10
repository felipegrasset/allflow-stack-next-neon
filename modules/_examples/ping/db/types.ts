import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface PingTable {
  id: string
  message: string
  created_at: Timestamp
}

/**
 * How a module adds its tables to `Database` without editing
 * server/db/schema/index.ts: interface merging. The augmentation applies as
 * soon as this file is part of the program, so it must be a module (it is: it
 * exports) and the specifier must resolve to the same file as the import.
 */
declare module "@/server/db/schema" {
  interface Database {
    ping_pings: PingTable
  }
}
