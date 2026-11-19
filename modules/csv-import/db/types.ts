import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface CsvImportRunsTable {
  id: string
  target: string
  file_name: string | null
  status: string
  total_rows: number
  imported_rows: ColumnType<number, number | undefined, number>
  skipped_rows: ColumnType<number, number | undefined, number>
  error_code: string | null
  /** User id, no foreign key on purpose. Null when run without a session. */
  created_by: string | null
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    csv_import_runs: CsvImportRunsTable
  }
}
