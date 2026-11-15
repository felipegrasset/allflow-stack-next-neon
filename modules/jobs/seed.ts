import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

/** Demo history (invented job names). Fixed ids, idempotent; no 'running' row, so the lock is never held by sample data. */
export async function seed(db: Kysely<Database>): Promise<void> {
  const hour = 3_600_000
  const now = Date.now()
  const rows = [
    { n: 1, ago: 50, name: "send-reminders", kind: "cron", status: "succeeded", ms: 1840, error: null, result: { sent: 12 } },
    { n: 2, ago: 26, name: "send-reminders", kind: "cron", status: "failed", ms: 310, error: "smtp: connection timed out", result: null },
    { n: 3, ago: 24, name: "send-reminders", kind: "manual", status: "succeeded", ms: 2210, error: null, result: { sent: 15 } },
    { n: 4, ago: 20, name: "jobs-prune", kind: "cron", status: "succeeded", ms: 95, error: null, result: { deleted: 0 } },
  ] as const
  for (const r of rows) {
    const started = new Date(now - r.ago * hour)
    await db
      .insertInto("jobs_runs")
      .values({
        id: `seed-job-${String(r.n).padStart(4, "0")}`,
        name: r.name,
        kind: r.kind,
        status: r.status,
        triggered_by: r.kind === "manual" ? "seed-user-camila" : null,
        started_at: started,
        finished_at: new Date(started.getTime() + r.ms),
        duration_ms: r.ms,
        lock_expires_at: new Date(started.getTime() + r.ms + 30_000),
        error: r.error,
        result: r.result ? JSON.stringify(r.result) : null,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute()
  }
}
