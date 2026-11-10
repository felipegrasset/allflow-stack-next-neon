import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface NotificationsTable {
  id: string
  user_id: string
  kind: Generated<"info" | "success" | "warning" | "error">
  title: string
  body: string | null
  href: string | null
  read_at: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >
  created_at: Timestamp
}

/** Fusión de interfaces: suma la tabla a `Database` sin editar server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    notifications: NotificationsTable
  }
}
