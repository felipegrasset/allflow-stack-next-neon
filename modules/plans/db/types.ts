import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
/** `bigint` arrives as a string from pg and from Neon. */
type BigIntColumn = ColumnType<string | null, number | string | null | undefined, number | string | null>

export interface PlansPlansTable {
  id: string
  key: string
  name_es: string
  name_en: string
  description_es: string | null
  description_en: string | null
  plan_ref: string | null
  is_default: Generated<boolean>
  active: Generated<boolean>
  /** Offered for sale (0128). Needs `plan_ref` and `active`. */
  published: Generated<boolean>
  /** Informational price text (0128); the real price lives in the provider. */
  price_note_es: string | null
  price_note_en: string | null
  sort: Generated<number>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PlansEntitlementsTable {
  id: string
  plan_id: string
  key: string
  kind: "feature" | "limit"
  enabled: Generated<boolean>
  limit_value: BigIntColumn
  label_es: string | null
  label_en: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

/** The last change / cancel a subject asked the provider for (0128). Display only. */
export interface PlansSubscriptionRequestsTable {
  subject: string
  kind: "change" | "cancel"
  subscription_id: string
  from_plan_ref: string | null
  to_plan_id: string | null
  to_plan_ref: string | null
  at_period_end: boolean | null
  requested_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    plans_plans: PlansPlansTable
    plans_entitlements: PlansEntitlementsTable
    plans_subscription_requests: PlansSubscriptionRequestsTable
  }
}
