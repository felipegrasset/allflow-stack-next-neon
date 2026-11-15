/**
 * The only thing another module (or the app) may import from `events`.
 * Server side only.
 *
 *   import { track } from "@/modules/events/contracts"
 *
 *   // In a Server Action or route handler, after the work is done:
 *   await track("order_paid", { amount: 19900, currency: "CLP", plan: "pro" })
 *
 * The event is tied to the signed-in user's id (`external_user_id`); pass
 * `identity` for webhooks and jobs, where there is no session. Without
 * ALLFLOW_INGEST_URL / ALLFLOW_INGEST_KEY it does nothing. It never throws.
 */
import { after } from "next/server"

import { getSession } from "@/server/session"

import {
  sendEvent,
  type EventProps,
  type TrackDeps,
  type TrackIdentity,
  type TrackOptions,
  type TrackResult,
} from "../server/track"

export {
  DEFAULT_ALLOWED_PROPS,
  isValidEventName,
  type EventProps,
  type TrackIdentity,
  type TrackOptions,
  type TrackResult,
} from "../server/track"

const deps = (): TrackDeps => ({
  fetch: (input, init) => fetch(input, init),
  env: {
    ALLFLOW_INGEST_URL: process.env.ALLFLOW_INGEST_URL,
    ALLFLOW_INGEST_KEY: process.env.ALLFLOW_INGEST_KEY,
  },
  log: (msg) => console.warn(msg),
})

async function resolveIdentity(identity?: TrackIdentity): Promise<TrackIdentity> {
  if (identity?.userId || identity?.email) return identity
  try {
    const session = await getSession()
    return session ? { userId: session.user.id } : {}
  } catch {
    return {}
  }
}

/**
 * Sends one event and resolves when the attempt finished (at most ~3 s). Never
 * rejects. Without `identity` it uses the signed-in user; with neither it does
 * nothing (`no_identity`).
 */
export async function track(
  name: string,
  props?: EventProps,
  options: TrackOptions & { identity?: TrackIdentity } = {}
): Promise<TrackResult> {
  try {
    const { identity, ...opts } = options
    return await sendEvent(name, props, await resolveIdentity(identity), opts, deps())
  } catch {
    return { ok: false, reason: "error" }
  }
}

/**
 * Like `track`, but does not make the response wait: the delivery runs after
 * the response is sent (Next `after`). The identity is resolved first, while
 * the request is still at hand. Outside a request it falls back to a
 * fire-and-forget call. Prefer this in actions where the person is waiting.
 */
export async function trackAfter(
  name: string,
  props?: EventProps,
  options: TrackOptions & { identity?: TrackIdentity } = {}
): Promise<void> {
  try {
    const identity = await resolveIdentity(options.identity)
    const run = () => track(name, props, { ...options, identity }).then(() => undefined)
    try {
      after(run)
    } catch {
      void run()
    }
  } catch {
    // Tracking never breaks the caller.
  }
}
