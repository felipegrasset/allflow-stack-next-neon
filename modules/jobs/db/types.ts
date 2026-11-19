import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, never>
/** jsonb: read back parsed, written as a JSON string. */
type Json = ColumnType<unknown, string | null | undefined, string | null | undefined>

export interface JobsRunsTable {
  id: string
  name: ColumnType<string, string, never>
  kind: ColumnType<"cron" | "manual", "cron" | "manual", never>
  status: ColumnType<"running" | "succeeded" | "failed", "running" | "succeeded" | "failed" | undefined, "running" | "succeeded" | "failed">
  /** User id for a manual run; null for cron. No foreign key (history outlives the user). */
  triggered_by: ColumnType<string | null, string | null | undefined, never>
  started_at: Timestamp
  finished_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
  duration_ms: ColumnType<number | null, number | null | undefined, number | null>
  lock_expires_at: ColumnType<Date, Date | string, Date | string>
  error: ColumnType<string | null, string | null | undefined, string | null>
  result: Json
}

declare module "@/server/db/schema" {
  interface Database {
    jobs_runs: JobsRunsTable
  }
}
