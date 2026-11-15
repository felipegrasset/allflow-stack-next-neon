/**
 * The access grant. `<Comments>` (server) runs the host's `canAccess` check for
 * the viewer, and hands the client a signed token with the result: who, which
 * record, where to link, and which people may be mentioned (those who can see
 * the record too). Server Actions are reachable by direct POST and cannot call
 * a function of the host, so they trust ONLY this token (HMAC-SHA256, short
 * expiry) and check it matches the signed-in user. Pure: node:crypto only,
 * secret and clock injected.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

export type Grant = {
  /** viewer user id */
  u: string
  /** entity key */
  e: string
  /** entity id */
  i: string
  /** relative link of the page that shows the thread (for notifications) */
  h: string
  /** ids of people who can see the record and may be mentioned */
  m: string[]
  /** expiry, ms since epoch */
  x: number
}

export const GRANT_TTL_MS = 2 * 3600 * 1000

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url")
const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url")

export function signGrant(grant: Grant, secret: string | undefined): string | null {
  if (!secret) return null
  const payload = b64(JSON.stringify(grant))
  return `${payload}.${mac(payload, secret)}`
}

/** null when the token is malformed, forged, expired or there is no secret. */
export function verifyGrant(token: unknown, secret: string | undefined, now = Date.now()): Grant | null {
  if (!secret || typeof token !== "string" || token.length > 8000) return null
  const [payload, sig, extra] = token.split(".")
  if (!payload || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(payload, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const g = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Grant>
    if (
      typeof g.u !== "string" ||
      typeof g.e !== "string" ||
      typeof g.i !== "string" ||
      typeof g.h !== "string" ||
      !Array.isArray(g.m) ||
      !g.m.every((x) => typeof x === "string") ||
      typeof g.x !== "number" ||
      g.x < now
    )
      return null
    return g as Grant
  } catch {
    return null
  }
}
