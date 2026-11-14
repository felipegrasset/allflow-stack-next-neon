import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
/** jsonb: read back as parsed JSON (validated again with zod), written as a JSON string. */
type Json = ColumnType<unknown, string, string>

export interface ApprovalsFlowsTable {
  id: string
  key: string
  definition: Json
  active: ColumnType<boolean, boolean | undefined, boolean>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ApprovalsRequestsTable {
  id: string
  flow_id: string
  flow_key: string
  definition: Json
  entity: string
  entity_id: string
  title: string
  href: string | null
  state: string
  requested_by: string
  created_at: Timestamp
  updated_at: Timestamp
  closed_at: NullableTimestamp
}

export interface ApprovalsEventsTable {
  id: string
  request_id: string
  actor_id: string
  action: string
  from_state: string | null
  to_state: string
  comment: string | null
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    approvals_flows: ApprovalsFlowsTable
    approvals_requests: ApprovalsRequestsTable
    approvals_events: ApprovalsEventsTable
  }
}
