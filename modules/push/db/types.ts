import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface PushSubscriptionsTable {
  id: string
  user_id: string
  /** Push service URL. A bearer capability: never log it, never send it to the client of another user. */
  endpoint: string
  /** `keys.p256dh` of the PushSubscription (base64url, 65 bytes). */
  p256dh: string
  /** `keys.auth` of the PushSubscription (base64url, 16 bytes). */
  auth: string
  failure_count: Generated<number>
  last_success_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
  created_at: Timestamp
  updated_at: Timestamp
}

/** Interface merging: adds the table to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    push_subscriptions: PushSubscriptionsTable
  }
}
