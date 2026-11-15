/**
 * Validation of what the browser posts (`PushSubscription.toJSON()`). Pure.
 */
import { z } from "zod"

import { b64urlDecode, isUncompressedP256, publicKeyIsOnCurve } from "./crypto/webpush"
import { checkEndpoint, MAX_ENDPOINT_LENGTH } from "./endpoint"

const b64url = z.string().regex(/^[A-Za-z0-9_-]+$/)

export const subscribeBodySchema = z.object({
  endpoint: z.string().min(1).max(MAX_ENDPOINT_LENGTH),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: b64url.max(100), auth: b64url.max(40) }),
})

export const unsubscribeBodySchema = z.object({
  endpoint: z.string().min(1).max(MAX_ENDPOINT_LENGTH),
})

export type ValidSubscription = { endpoint: string; p256dh: string; auth: string }

export type SubscriptionCheck =
  | { ok: true; value: ValidSubscription }
  | { ok: false; error: "bad_request" | "endpoint_not_allowed" }

export function validateSubscription(raw: unknown): SubscriptionCheck {
  const parsed = subscribeBodySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "bad_request" }
  const { endpoint, keys } = parsed.data
  if (!checkEndpoint(endpoint)) return { ok: false, error: "endpoint_not_allowed" }
  const p256dh = b64urlDecode(keys.p256dh)
  const auth = b64urlDecode(keys.auth)
  if (!isUncompressedP256(p256dh) || !publicKeyIsOnCurve(p256dh) || auth.length !== 16)
    return { ok: false, error: "bad_request" }
  return { ok: true, value: { endpoint, p256dh: keys.p256dh, auth: keys.auth } }
}
