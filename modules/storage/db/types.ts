import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface StorageFilesTable {
  id: string
  owner_id: string | null
  name: string
  content_type: string
  size_bytes: number
  provider: string
  provider_key: string
  visibility: Generated<"private" | "members" | "public">
  entity: string | null
  entity_id: string | null
  created_at: Timestamp
}

/** Interface merging: adds the table to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    storage_files: StorageFilesTable
  }
}
