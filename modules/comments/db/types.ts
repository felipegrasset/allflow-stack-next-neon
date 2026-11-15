import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface CommentsTable {
  id: string
  entity: string
  entity_id: string
  author_id: string
  body: string
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    comments: CommentsTable
  }
}
