import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>
/** `bigint` llega como string desde pg y desde Neon. */
type Amount = ColumnType<string, number | string, number | string>

export interface PaymentsTable {
  id: string
  order_id: string
  provider: "mercadopago" | "flow" | "paddle"
  environment: "sandbox" | "production"
  status: Generated<
    "pending" | "failed" | "approved" | "refunded" | "canceled" | "needs_review"
  >
  amount_minor: Amount
  currency: string
  refunded_minor: ColumnType<
    string,
    number | string | undefined,
    number | string
  >
  description: string
  payer_email: string | null
  external_id: string | null
  provider_payment_id: string | null
  checkout_url: string | null
  created_at: Timestamp
  updated_at: Timestamp
  approved_at: NullableTimestamp
}

export interface PaymentsEventsTable {
  id: string
  provider: string
  event_id: string
  type: string
  outcome: string
  payment_id: string | null
  amount_minor: ColumnType<
    string | null,
    number | string | null | undefined,
    never
  >
  currency: string | null
  received_at: Timestamp
}

export interface PaymentsSubscriptionsTable {
  id: string
  provider: "mercadopago" | "flow" | "paddle"
  external_id: string
  subscriber_ref: string
  plan_ref: string | null
  status: Generated<"pending" | "active" | "past_due" | "canceled">
  current_period_end: NullableTimestamp
  created_at: Timestamp
  updated_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    payments: PaymentsTable
    payments_events: PaymentsEventsTable
    payments_subscriptions: PaymentsSubscriptionsTable
  }
}
