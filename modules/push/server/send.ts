/**
 * Delivery to a list of subscriptions, with every dependency injected (fetch,
 * clock, store, log) so the tests run it against a fake push service.
 *
 * Per subscription: 2xx → sent; 404 or 410 → the subscription is gone (RFC
 * 8030 Section 7.3) and is DELETED; anything else (413, 429, 5xx, timeout,
 * network) → failed, kept, counted. Logs carry the push service host and the
 * status, never the endpoint, the keys, the user or the message.
 */
import type { VapidConfig } from "./config"
import { checkEndpoint, endpointHost } from "./endpoint"
import type { ResolvedSendOptions } from "./payload"
import { buildPushRequest, type SubscriptionKeys } from "./request"

export type StoredSubscription = SubscriptionKeys & { id: string }

export type DeliveryResult = {
  /** Accepted by the push service (not a proof the device showed it). */
  sent: number
  /** Answered 404/410 and deleted. */
  removed: number
  failed: number
}

export type DeliverDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  vapid: VapidConfig
  nowSeconds: () => number
  /** Deletes subscriptions by id (the gone ones). */
  remove: (ids: string[]) => Promise<void>
  /** Bookkeeping, optional: ids accepted and ids that failed. */
  record?: (outcome: { ok: string[]; failed: string[] }) => Promise<void>
  log?: (msg: string, detail?: Record<string, unknown>) => void
  /** Per request; default 10 s. */
  timeoutMs?: number
  /** Parallel requests; default 10. */
  concurrency?: number
}

type Outcome = "sent" | "gone" | "failed"

export const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410])

async function deliverOne(
  sub: StoredSubscription,
  plaintext: Uint8Array,
  options: ResolvedSendOptions,
  deps: DeliverDeps
): Promise<Outcome> {
  const host = endpointHost(sub.endpoint)
  if (!checkEndpoint(sub.endpoint)) {
    deps.log?.("push: endpoint not allowed, skipped", { host })
    return "failed"
  }
  let req
  try {
    req = buildPushRequest({ subscription: sub, plaintext, vapid: deps.vapid, options, nowSeconds: deps.nowSeconds() })
  } catch (err) {
    // Corrupt keys in the row: it can never be delivered.
    deps.log?.("push: could not encrypt for subscription", { host, error: (err as Error).message })
    return "failed"
  }
  try {
    const res = await deps.fetch(req.url, {
      method: req.init.method,
      headers: req.init.headers,
      body: req.init.body as unknown as BodyInit,
      redirect: "error",
      signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
    })
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => undefined)
    if (res.status >= 200 && res.status < 300) return "sent"
    if (GONE_STATUSES.has(res.status)) return "gone"
    deps.log?.("push: push service refused", { host, status: res.status })
    return "failed"
  } catch (err) {
    deps.log?.("push: request failed", { host, error: (err as Error).name })
    return "failed"
  }
}

export async function deliver(
  subs: readonly StoredSubscription[],
  plaintext: Uint8Array,
  options: ResolvedSendOptions,
  deps: DeliverDeps
): Promise<DeliveryResult> {
  const result: DeliveryResult = { sent: 0, removed: 0, failed: 0 }
  if (subs.length === 0) return result
  const gone: string[] = []
  const ok: string[] = []
  const failed: string[] = []
  const size = Math.max(1, deps.concurrency ?? 10)
  for (let i = 0; i < subs.length; i += size) {
    const batch = subs.slice(i, i + size)
    const outcomes = await Promise.all(batch.map((s) => deliverOne(s, plaintext, options, deps)))
    outcomes.forEach((o, j) => {
      const id = batch[j].id
      if (o === "sent") ok.push(id)
      else if (o === "gone") gone.push(id)
      else failed.push(id)
    })
  }
  result.sent = ok.length
  result.failed = failed.length
  if (gone.length) {
    try {
      await deps.remove(gone)
      result.removed = gone.length
    } catch (err) {
      deps.log?.("push: could not delete gone subscriptions", { count: gone.length, error: (err as Error).name })
      result.failed += gone.length
    }
  }
  if (deps.record && (ok.length || failed.length)) {
    await deps.record({ ok, failed }).catch((err: unknown) =>
      deps.log?.("push: could not record delivery", { error: (err as Error).name })
    )
  }
  return result
}
