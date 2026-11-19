import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface ReportsDashboardsTable {
  id: string
  /** Parsed jsonb on read (validate it with `dashboardSchema`); a JSON string on write. */
  definition: ColumnType<unknown, string, string>
  position: Generated<number>
  created_at: Timestamp
  updated_at: Timestamp
}

/** Interface merging: adds the table to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    reports_dashboards: ReportsDashboardsTable
  }
}
