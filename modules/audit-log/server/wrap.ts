/**
 * `audited()`: wraps a server function so that, once it succeeds, an audit row
 * is recorded. No runtime imports (the recorder is injected), so it is testable.
 */
import type { AuditEntryInput } from "../contracts/input"

export type AuditSpec<A extends unknown[], R> = {
  action: string
  entity: string
  /** Id of the record the function changed (may come from the result). */
  entityId: (args: A, result: R) => string | number
  /** Snapshot BEFORE running (read the record). If it throws, the function does not run. */
  before?: (args: A) => unknown | Promise<unknown>
  /** Snapshot AFTER running (default: none; with only `before` the row records a deletion). */
  after?: (args: A, result: R) => unknown | Promise<unknown>
  actor?: AuditEntryInput["actor"]
  sensitive?: string[]
  /** true: a failed audit write rejects the call. Default false: logged, the call still returns. */
  strict?: boolean
}

export type Recorder = (entry: AuditEntryInput) => Promise<unknown>

export function createAudited(record: Recorder) {
  return function audited<A extends unknown[], R>(
    spec: AuditSpec<A, R>,
    fn: (...args: A) => Promise<R>
  ): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
      const before = spec.before ? await spec.before(args) : undefined
      const result = await fn(...args) // a failure here records nothing
      try {
        const after = spec.after ? await spec.after(args, result) : undefined
        await record({
          action: spec.action,
          entity: spec.entity,
          entityId: String(spec.entityId(args, result)),
          before,
          after,
          actor: spec.actor,
          sensitive: spec.sensitive,
        })
      } catch (e) {
        if (spec.strict) throw e
        console.error(`[audit-log] could not record ${spec.action}`, e)
      }
      return result
    }
  }
}
