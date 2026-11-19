import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>
/** bigint: node-postgres returns int8 as a string. */
type BigintMinor = ColumnType<
  string,
  number | string | bigint | undefined,
  number | string | bigint
>

export interface CrmLiteContactsTable {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  status: Generated<"lead" | "customer">
  notes: string | null
  owner_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CrmLiteDealsTable {
  id: string
  contact_id: string
  name: string
  amount_minor: BigintMinor
  currency: string
  stage: Generated<
    "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
  >
  owner_id: string | null
  closed_at: NullableTimestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CrmLiteActivitiesTable {
  id: string
  contact_id: string
  deal_id: string | null
  kind: "note" | "call" | "email" | "meeting" | "stage_change"
  body: string | null
  from_stage: string | null
  to_stage: string | null
  author_id: string | null
  created_at: Timestamp
}

/** Interface merging: adds the tables to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    crm_lite_contacts: CrmLiteContactsTable
    crm_lite_deals: CrmLiteDealsTable
    crm_lite_activities: CrmLiteActivitiesTable
  }
}
