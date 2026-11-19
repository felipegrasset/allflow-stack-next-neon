import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface NotificationsEmailPrefsTable {
  user_id: string
  enabled: ColumnType<boolean, boolean | undefined, boolean>
  updated_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    notifications_email_prefs: NotificationsEmailPrefsTable
  }
}
