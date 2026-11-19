import { getKysely } from "@/server/db/pool"

import { es } from "../messages"
import { defineJob } from "./registry"
import { pruneRuns } from "./store"

/** Runs older than this are deleted by `jobs-prune`. */
export const RETENTION_DAYS = 30

/** Housekeeping: keeps the history table from growing forever. Schedule it daily (see MODULE.md). */
defineJob(
  "jobs-prune",
  async () => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
    return { deleted: await pruneRuns(getKysely(), cutoff) }
  },
  { description: es.jobs.builtin.prune, schedule: "0 4 * * *" }
)
