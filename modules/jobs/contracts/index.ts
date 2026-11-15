/**
 * The only thing another module (or the app) may import from `jobs`:
 *
 *   import { defineJob } from "@/modules/jobs/contracts"
 *
 *   defineJob("send-reminders", async ({ signal }) => {
 *     // ...work; stop if signal.aborted
 *     return { sent: 12 }          // stored (truncated) as the run's result
 *   }, { description: "Recordatorios diarios", schedule: "0 12 * * *" })
 *
 * Then import the file that calls defineJob from `modules/jobs/register.ts`
 * and add the cron to vercel.json (see MODULE.md). No runtime imports here.
 */
export {
  DEFAULT_TIMEOUT_MS,
  JOB_NAME,
  MAX_TIMEOUT_MS,
  defineJob,
  getJob,
  listJobs,
  type JobContext,
  type JobDefinition,
  type JobHandler,
  type JobOptions,
  type RunKind,
} from "../server/registry"
