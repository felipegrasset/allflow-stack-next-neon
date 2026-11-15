/**
 * Signed unsubscribe links. Pure (node:crypto only), so it runs in tests.
 * token = base64url(userId) "." base64url(HMAC-SHA256(secret, "ne:unsub:" + userId)).
 * No expiry on purpose: an unsubscribe link must keep working. It can only
 * ever turn emails OFF for the person it names, and it cannot be forged
 * without the secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url")

function mac(userId: string, secret: string): string {
  return b64(createHmac("sha256", secret).update(`ne:unsub:${userId}`).digest())
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  if (!userId || !secret) throw new Error("notifications-email: userId and secret are required")
  return `${b64(userId)}.${mac(userId, secret)}`
}

/** The user id when the token is authentic, else null. Never throws. */
export function verifyUnsubscribeToken(token: unknown, secret: string | undefined): string | null {
  if (typeof token !== "string" || !secret || token.length > 600) return null
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  let userId: string
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8")
  } catch {
    return null
  }
  if (!userId) return null
  const given = Buffer.from(parts[1])
  const want = Buffer.from(mac(userId, secret))
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  return userId
}

/** `<base>/notifications/unsubscribe?token=…` */
export function unsubscribeUrl(baseUrl: string, userId: string, secret: string): string {
  const u = new URL("/notifications/unsubscribe", baseUrl)
  u.searchParams.set("token", signUnsubscribeToken(userId, secret))
  return u.toString()
}
