/**
 * The HTTP request to a push service (RFC 8030 Section 5) for one
 * subscription. Pure: everything comes in as arguments, so the tests can check
 * headers and decrypt the body.
 */
import { b64urlDecode, encryptPayload, vapidAuthorization } from "./crypto/webpush"
import type { VapidConfig } from "./config"
import type { ResolvedSendOptions } from "./payload"

export type SubscriptionKeys = { endpoint: string; p256dh: string; auth: string }

export type PushRequest = { url: string; init: { method: "POST"; headers: Record<string, string>; body: Uint8Array } }

export function buildPushRequest(args: {
  subscription: SubscriptionKeys
  plaintext: Uint8Array
  vapid: VapidConfig
  options: ResolvedSendOptions
  nowSeconds: number
  /** Only for tests: fixed salt / ECDH key (see encryptPayload). */
  salt?: Uint8Array
  asPrivateKey?: Uint8Array
}): PushRequest {
  const url = new URL(args.subscription.endpoint)
  const body = encryptPayload({
    plaintext: args.plaintext,
    uaPublic: b64urlDecode(args.subscription.p256dh),
    authSecret: b64urlDecode(args.subscription.auth),
    salt: args.salt,
    asPrivateKey: args.asPrivateKey,
  })
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "content-encoding": "aes128gcm",
    ttl: String(args.options.ttl),
    urgency: args.options.urgency,
    authorization: vapidAuthorization({
      audience: url.origin,
      subject: args.vapid.subject,
      publicKey: args.vapid.publicKey,
      privateKey: args.vapid.privateKey,
      nowSeconds: args.nowSeconds,
    }),
  }
  if (args.options.topic) headers.topic = args.options.topic
  return { url: url.toString(), init: { method: "POST", headers, body } }
}
