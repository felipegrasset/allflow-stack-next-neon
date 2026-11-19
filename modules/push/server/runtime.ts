/**
 * The real dependencies (env, database, fetch, console), in one place. The
 * logic they feed (send.ts, handlers.ts) never reads them directly.
 */
import { getKysely } from "@/server/db/pool"
import { getSession } from "@/server/session"

import { canSubscribe } from "./authz"
import { readVapidConfig } from "./config"
import type { SubscribeDeps } from "./handlers"
import type { DeliverDeps } from "./send"
import * as store from "./store"

export const log = (msg: string, detail?: Record<string, unknown>) => console.error(msg, detail ?? {})

export function subscribeDeps(): SubscribeDeps {
  return {
    userId: async () => (await getSession())?.user.id ?? null,
    canSubscribe,
    configured: () => readVapidConfig().ok,
    save: (userId, sub) => store.upsertSubscription(getKysely(), { userId, ...sub }),
    removeOwn: (userId, endpoint) => store.deleteOwnSubscription(getKysely(), userId, endpoint),
    log,
  }
}

/** Delivery deps, or null when VAPID is not configured (then nothing is sent). */
export function deliverDeps(): DeliverDeps | null {
  const cfg = readVapidConfig()
  if (!cfg.ok) return null
  return {
    fetch: (url, init) => fetch(url, init),
    vapid: cfg.config,
    nowSeconds: () => Math.floor(Date.now() / 1000),
    remove: (ids) => store.deleteByIds(getKysely(), ids),
    record: (outcome) => store.recordOutcome(getKysely(), outcome),
    log,
  }
}
