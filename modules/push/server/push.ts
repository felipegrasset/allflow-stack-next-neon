/**
 * sendPush / notifyWithPush: what contracts/ exposes. Server only.
 */
import { notify, type NotifyInput, type NotifyResult } from "@/modules/notifications/contracts"
import { getKysely } from "@/server/db/pool"

import { pushPayloadSchema, sendOptionsSchema, wirePayload, type PushPayload, type SendOptions } from "./payload"
import { readVapidConfig } from "./config"
import { deliverDeps, log } from "./runtime"
import { deliver, type DeliveryResult } from "./send"
import * as store from "./store"

export type SendPushResult = DeliveryResult & {
  /** false: VAPID_* missing or invalid; nothing was sent. */
  configured: boolean
  /** Subscriptions the user had. */
  devices: number
}

export function isPushConfigured(): boolean {
  return readVapidConfig().ok
}

/** The public VAPID key (base64url) for `applicationServerKey`, or null if not configured. */
export function vapidPublicKey(): string | null {
  const cfg = readVapidConfig()
  return cfg.ok ? cfg.config.publicKeyText : null
}

/**
 * Sends a web push to every device `userId` subscribed. Validates the payload
 * (throws ZodError if invalid). Never throws for delivery problems: they are
 * counted. Subscriptions answered 404/410 are deleted. Without VAPID config it
 * returns `configured: false` and sends nothing.
 */
export async function sendPush(userId: string, payload: PushPayload, options?: SendOptions): Promise<SendPushResult> {
  const p = pushPayloadSchema.parse(payload)
  const opts = sendOptionsSchema.parse(options)
  const deps = deliverDeps()
  if (!deps) return { configured: false, devices: 0, sent: 0, removed: 0, failed: 0 }
  const subs = await store.listForUser(getKysely(), userId)
  const r = await deliver(subs, wirePayload(p), opts, deps)
  return { configured: true, devices: subs.length, ...r }
}

export type NotifyWithPushResult = NotifyResult & { push: SendPushResult | null }

/**
 * `notify()` (the in-app aviso) and, only if the aviso was NEW, a push with
 * the same title, body and href. With `input.id` it is idempotent end to end:
 * repeating it creates no aviso and sends no second push (`push: null`).
 * A push failure never undoes or fails the aviso: it is logged and reported.
 */
export async function notifyWithPush(input: NotifyInput, options?: SendOptions): Promise<NotifyWithPushResult> {
  const result = await notify(input)
  if (!result.created) return { ...result, push: null }
  try {
    const push = await sendPush(
      input.userId,
      { title: input.title, body: input.body, href: input.href, tag: input.id ? input.id.slice(0, 64) : undefined },
      options
    )
    return { ...result, push }
  } catch (err) {
    log("push: notifyWithPush could not send", { error: (err as Error).name })
    return { ...result, push: null }
  }
}
