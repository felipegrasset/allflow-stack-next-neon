/** Database side of the runs. Every value is a bound parameter. Server-only. */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import type { AcquireInput, FinishInput, RunStore } from "./runner"

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505"
}

export function createRunStore(db: Kysely<Database>): RunStore {
  return {
    async acquire(input: AcquireInput) {
      const now = new Date()
      // A crashed run leaves a 'running' row behind; once its lock expired, close it so a new run can start.
      await db
        .updateTable("jobs_runs")
        .set({ status: "failed", finished_at: now, error: "lock expired: the run did not finish" })
        .where("name", "=", input.name)
        .where("status", "=", "running")
        .where("lock_expires_at", "<", now)
        .execute()
      const id = randomUUID()
      try {
        await db
          .insertInto("jobs_runs")
          .values({
            id,
            name: input.name,
            kind: input.kind,
            triggered_by: input.triggeredBy,
            lock_expires_at: new Date(now.getTime() + input.lockMs),
          })
          .execute()
      } catch (e) {
        // The partial unique index says another run of this job is alive.
        if (isUniqueViolation(e)) return null
        throw e
      }
      return { id }
    },

    async finish(id: string, input: FinishInput) {
      await db
        .updateTable("jobs_runs")
        .set({
          status: input.status,
          finished_at: new Date(),
          duration_ms: input.durationMs,
          error: input.error,
          result: input.result,
        })
        // Only a run that is still open: one closed by a takeover keeps its verdict.
        .where("id", "=", id)
        .where("status", "=", "running")
        .execute()
    },
  }
}

/** Deletes finished runs older than `olderThan`. Never touches a running one. */
export async function pruneRuns(db: Kysely<Database>, olderThan: Date): Promise<number> {
  const res = await db
    .deleteFrom("jobs_runs")
    .where("status", "<>", "running")
    .where("finished_at", "<", olderThan)
    .executeTakeFirst()
  return Number(res.numDeletedRows ?? 0)
}
