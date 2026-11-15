/**
 * Job registry. Pure (no imports). Kept on globalThis because Next bundles the
 * route handler and the admin page separately: a module-level Map would be a
 * different instance in each.
 */
export const JOB_NAME = /^[a-z0-9][a-z0-9_.:-]{0,79}$/
export const DEFAULT_TIMEOUT_MS = 300_000
export const MAX_TIMEOUT_MS = 900_000

export type RunKind = "cron" | "manual"

export type JobContext = {
  runId: string
  name: string
  kind: RunKind
  /** Aborted when the job exceeds its timeout; long handlers should stop when it fires. */
  signal: AbortSignal
}

/** May return any JSON-friendly value: it is stored (truncated) as the run's result. */
export type JobHandler = (ctx: JobContext) => Promise<unknown> | unknown

export type JobOptions = {
  /** Shown in /admin/jobs. */
  description?: string
  /** Cron expression, for display only: the real schedule lives in vercel.json. */
  schedule?: string
  /** Max run time and lock lifetime. Default 5 min, max 15. */
  timeoutMs?: number
}

export type JobDefinition = {
  name: string
  handler: JobHandler
  description: string | null
  schedule: string | null
  timeoutMs: number
}

const KEY = Symbol.for("fulvia.jobs.registry")
type G = { [KEY]?: Map<string, JobDefinition> }

function registry(): Map<string, JobDefinition> {
  const g = globalThis as unknown as G
  return (g[KEY] ??= new Map())
}

/**
 * Registers a job (or replaces one with the same name, so dev reloads work).
 * Throws on an invalid name or timeout: a typo must fail at startup, not at 3 a.m.
 */
export function defineJob(name: string, handler: JobHandler, options: JobOptions = {}): JobDefinition {
  if (!JOB_NAME.test(name)) throw new Error(`invalid job name "${name}" (lower case, digits, _ . : -, max 80)`)
  if (typeof handler !== "function") throw new Error(`job "${name}": handler must be a function`)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS)
    throw new Error(`job "${name}": timeoutMs must be between 1000 and ${MAX_TIMEOUT_MS}`)
  const def: JobDefinition = {
    name,
    handler,
    description: options.description?.trim().slice(0, 300) || null,
    schedule: options.schedule?.trim().slice(0, 100) || null,
    timeoutMs,
  }
  registry().set(name, def)
  return def
}

export function getJob(name: string): JobDefinition | undefined {
  return registry().get(name)
}

export function listJobs(): JobDefinition[] {
  return [...registry().values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Tests only. */
export function clearJobs(): void {
  registry().clear()
}
