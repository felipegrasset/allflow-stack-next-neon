import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
/** `bigint` arrives as a string from pg and from Neon. */
type Amount = ColumnType<string, number | string, number | string>
type NullableAmount = ColumnType<string | null, number | string | null, number | string | null>

export interface DiscountsCodesTable {
  id: string
  code: string
  kind: string
  percent_bp: number | null
  amount_minor: NullableAmount
  currency: string | null
  min_subtotal_minor: NullableAmount
  starts_at: NullableTimestamp
  ends_at: NullableTimestamp
  max_uses: number | null
  max_uses_per_user: number | null
  active: ColumnType<boolean, boolean | undefined, boolean>
  note: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface DiscountsRedemptionsTable {
  id: string
  code_id: string
  code: string
  order_id: string
  user_id: string
  amount_minor: Amount
  currency: string
  subtotal_minor: Amount
  created_at: Timestamp
  released_at: NullableTimestamp
  release_reason: string | null
  confirmed_at: NullableTimestamp
  checked_at: NullableTimestamp
}

declare module "@/server/db/schema" {
  interface Database {
    discounts_codes: DiscountsCodesTable
    discounts_redemptions: DiscountsRedemptionsTable
  }
}
