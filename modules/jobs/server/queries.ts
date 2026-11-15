import { getKysely } from "@/server/db/pool"

export type RunRow = {
  id: string
  name: string
  kind: "cron" | "manual"
  status: "running" | "succeeded" | "failed"
  startedAt: Date
  durationMs: number | null
  error: string | null
}

const COLUMNS = ["id", "name", "kind", "status", "started_at", "duration_ms", "error"] as const

type Raw = {
  id: string
  name: string
  kind: "cron" | "manual"
  status: "running" | "succeeded" | "failed"
  started_at: Date
  duration_ms: number | null
  error: string | null
}

const toRow = (r: Raw): RunRow => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  status: r.status,
  startedAt: r.started_at,
  durationMs: r.duration_ms,
  error: r.error,
})

/** Most recent runs, newest first (bounded). */
export async function listRuns(limit = 50): Promise<RunRow[]> {
  const rows = await getKysely()
    .selectFrom("jobs_runs")
    .select([...COLUMNS])
    .orderBy("started_at", "desc")
    .orderBy("id", "desc")
    .limit(Math.min(Math.max(limit, 1), 200))
    .execute()
  return rows.map(toRow)
}

/** The latest run of each job name that has ever run. */
export async function lastRunByJob(): Promise<Map<string, RunRow>> {
  const rows = await getKysely()
    .selectFrom("jobs_runs")
    .select([...COLUMNS])
    .distinctOn("name")
    .orderBy("name")
    .orderBy("started_at", "desc")
    .execute()
  return new Map(rows.map((r) => [r.name, toRow(r)]))
}
