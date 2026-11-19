import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>

export interface TicketsTable {
  id: string
  subject: string
  status: ColumnType<string, string | undefined, string>
  priority: ColumnType<string, string | undefined, string>
  requester_id: string
  entity: string | null
  entity_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
  closed_at: NullableTimestamp
}

export interface TicketsMessagesTable {
  id: string
  ticket_id: string
  author_id: string
  author_kind: string
  body: string
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    tickets: TicketsTable
    tickets_messages: TicketsMessagesTable
  }
}
