/**
 * Runs one job under the database lock. Pure: the store is injected, so the
 * rules (skip when locked, timeout, failure recording) are testable.
 */
import type { JobDefinition, RunKind } from "./registry"

/** Extra lock time on top of the job's timeout, so the row outlives a slow finish. */
export const LOCK_GRACE_MS = 30_000
const MAX_ERROR = 2_000
const MAX_RESULT_BYTES = 8_192

export type AcquireInput = { name: string; kind: RunKind; triggeredBy: string | null; lockMs: number }
export type FinishInput = {
  status: "succeeded" | "failed"
  durationMs: number
  error: string | null
  /** Already serialized JSON, or null. */
  result: string | null
}

export type RunStore = {
  /** Takes the lock and creates the run, or null when the job is already running. */
  acquire(input: AcquireInput): Promise<{ id: string } | null>
  finish(id: string, input: FinishInput): Promise<void>
}

export type RunOutcome =
  | { status: "skipped"; name: string }
  | { status: "succeeded"; name: string; runId: string; durationMs: number }
  | { status: "failed"; name: string; runId: string; durationMs: number; error: string }

export class JobTimeoutError extends Error {
  constructor(ms: number) {
    super(`job exceeded its timeout (${ms} ms)`)
    this.name = "JobTimeoutError"
  }
}

export function errorText(e: unknown): string {
  const s = e instanceof Error ? e.message || e.name : String(e)
  return s.length > MAX_ERROR ? `${s.slice(0, MAX_ERROR)}…` : s
}

/** JSON text for the result column; never throws; oversized results are replaced by a marker. */
export function serializeResult(value: unknown): string | null {
  if (value === undefined) return null
  let json: string | undefined
  try {
    json = JSON.stringify(value)
  } catch {
    return JSON.stringify({ unserializable: true })
  }
  if (json === undefined) return null
  return json.length > MAX_RESULT_BYTES ? JSON.stringify({ truncated: true }) : json
}

export async function runJob(
  def: JobDefinition,
  store: RunStore,
  opts: { kind: RunKind; triggeredBy?: string | null; log?: (msg: string, err?: unknown) => void }
): Promise<RunOutcome> {
  const log = opts.log ?? ((msg, err) => console.error(msg, err))
  const acquired = await store.acquire({
    name: def.name,
    kind: opts.kind,
    triggeredBy: opts.triggeredBy ?? null,
    lockMs: def.timeoutMs + LOCK_GRACE_MS,
  })
  if (!acquired) return { status: "skipped", name: def.name }

  const started = Date.now()
  const abort = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let finish: FinishInput
  try {
    const value = await Promise.race([
      Promise.resolve().then(() =>
        def.handler({ runId: acquired.id, name: def.name, kind: opts.kind, signal: abort.signal })
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort()
          reject(new JobTimeoutError(def.timeoutMs))
        }, def.timeoutMs)
      }),
    ])
    finish = { status: "succeeded", durationMs: Date.now() - started, error: null, result: serializeResult(value) }
  } catch (e) {
    finish = { status: "failed", durationMs: Date.now() - started, error: errorText(e), result: null }
  } finally {
    if (timer) clearTimeout(timer)
  }

  try {
    await store.finish(acquired.id, finish)
  } catch (e) {
    // The run happened; a failed bookkeeping write must not change its outcome.
    log(`[jobs] could not record the end of run ${acquired.id}`, e)
  }
  return finish.status === "succeeded"
    ? { status: "succeeded", name: def.name, runId: acquired.id, durationMs: finish.durationMs }
    : { status: "failed", name: def.name, runId: acquired.id, durationMs: finish.durationMs, error: finish.error ?? "" }
}
