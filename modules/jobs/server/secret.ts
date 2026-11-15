import { createHash, timingSafeEqual } from "node:crypto"

/** A shorter secret is treated as not configured (fail closed). */
export const MIN_SECRET_LENGTH = 16

/**
 * Constant-time comparison: both sides are hashed first, so the buffers have
 * the same length whatever the input and timingSafeEqual never throws or leaks it.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest()
  const hb = createHash("sha256").update(b, "utf8").digest()
  return timingSafeEqual(ha, hb)
}

/** "Bearer <token>" → token, or null. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null
  const m = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header)
  return m ? m[1] : null
}

export type AuthResult = "ok" | "not_configured" | "unauthorized"

export function checkCronAuth(authorization: string | null, secret: string | undefined): AuthResult {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return "not_configured"
  const token = bearerToken(authorization)
  if (token === null) return "unauthorized"
  return safeEqual(token, secret) ? "ok" : "unauthorized"
}
