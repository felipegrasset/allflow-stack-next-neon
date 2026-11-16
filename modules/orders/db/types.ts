import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
/** `bigint` arrives as a string from pg and from Neon. */
type Amount = ColumnType<string, number | string, number | string>

export interface OrdersOrdersTable {
  id: string
  user_id: string
  status: ColumnType<string, string | undefined, string>
  currency: string
  subtotal_minor: Amount
  discount_minor: ColumnType<string, number | string | undefined, number | string>
  total_minor: Amount
  discount_code: string | null
  discount_ref: string | null
  stock_ref: string
  payment_id: string | null
  expires_at: Timestamp
  paid_at: NullableTimestamp
  fulfilled_at: NullableTimestamp
  closed_at: NullableTimestamp
  stock_released_at: NullableTimestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface OrdersItemsTable {
  id: string
  order_id: string
  position: number
  item_id: string
  name: string
  sku: string | null
  unit_price_minor: Amount
  qty: number
  line_total_minor: Amount
}

export interface OrdersStatusHistoryTable {
  id: string
  order_id: string
  from_status: string | null
  to_status: string
  actor_kind: string
  actor_id: string | null
  note: string | null
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    orders_orders: OrdersOrdersTable
    orders_items: OrdersItemsTable
    orders_status_history: OrdersStatusHistoryTable
  }
}
