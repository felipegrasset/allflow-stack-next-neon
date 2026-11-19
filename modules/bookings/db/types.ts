import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>

export interface BookingsResourcesTable {
  id: string
  name: string
  kind: Generated<"room" | "professional" | "service">
  details: string | null
  /** IANA time zone the opening hours are expressed in. */
  timezone: string
  slot_minutes: Generated<number>
  active: Generated<boolean>
  created_at: Timestamp
}

export interface BookingsSchedulesTable {
  id: string
  resource_id: string
  /** 0 = Sunday … 6 = Saturday, in the resource's time zone. */
  weekday: number
  /** Minutes from local midnight; end is exclusive (1440 = midnight). */
  start_minute: number
  end_minute: number
  created_at: Timestamp
}

export interface BookingsBookingsTable {
  id: string
  resource_id: string
  user_id: string
  starts_at: ColumnType<Date, Date | string, Date | string>
  ends_at: ColumnType<Date, Date | string, Date | string>
  status: Generated<"confirmed" | "cancelled">
  note: string | null
  cancelled_at: NullableTimestamp
  cancelled_by: string | null
  created_at: Timestamp
}

/** Interface merging: adds the tables to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    bookings_resources: BookingsResourcesTable
    bookings_schedules: BookingsSchedulesTable
    bookings_bookings: BookingsBookingsTable
  }
}
