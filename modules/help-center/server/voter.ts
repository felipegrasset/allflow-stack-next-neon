import { createHash, randomUUID } from "node:crypto"

/** Name of the anonymous cookie that identifies a visitor's rating. */
export const VOTER_COOKIE = "help_center_voter"
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Keeps a well-formed token; anything else (missing, forged shape) gets a new one. */
export function ensureToken(existing: string | undefined): { token: string; isNew: boolean } {
  if (existing && TOKEN_RE.test(existing)) return { token: existing, isNew: false }
  return { token: randomUUID(), isNew: true }
}

/** What is stored: a hash, so the table never holds a usable cookie value. */
export function hashVoter(token: string): string {
  return createHash("sha256").update(`help-center:${token}`).digest("hex")
}
