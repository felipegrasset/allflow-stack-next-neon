/**
 * calendar-sync crypto with node:crypto only. Pure functions: no env, no
 * database, no network (tested in tests/calendar-sync.test.ts).
 *
 * - One master key, CALENDAR_SYNC_KEY: exactly 32 bytes as 64 hex characters.
 *   Two subkeys are derived from it with HKDF-SHA-256 (RFC 5869), one per use,
 *   so the key that encrypts tokens never signs anything:
 *     enc → AES-256-GCM of the OAuth tokens (and the PKCE verifier) at rest.
 *     mac → HMAC-SHA-256 of the OAuth `state`.
 * - Encrypted values: "v1.<iv>.<tag>.<ciphertext>" (base64url). 12-byte random
 *   IV per value (NIST SP 800-38D recommends 96-bit IVs), 16-byte tag that
 *   MUST verify, and associated data that binds the value to its row and
 *   field (a token copied to another user's row does not decrypt).
 * - OAuth `state`: "<nonce>.<hmac(nonce, session id)>". Signed AND single use:
 *   the nonce also has a row that the callback deletes atomically.
 * - PKCE (RFC 7636, S256), which Google supports for web server clients.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

export type DerivedKeys = { enc: Buffer; mac: Buffer }

/** Thrown when CALENDAR_SYNC_KEY is missing or not 64 hex characters. */
export class CalendarKeyError extends Error {
  constructor() {
    super("calendar-sync: CALENDAR_SYNC_KEY must be 64 hex characters (32 bytes): openssl rand -hex 32")
    this.name = "CalendarKeyError"
  }
}

const HEX64 = /^[0-9a-fA-F]{64}$/

/** The 32-byte master key, or CalendarKeyError. Never echoes the value. */
export function parseMasterKey(raw: string | undefined | null): Buffer {
  const v = (raw ?? "").trim()
  if (!HEX64.test(v)) throw new CalendarKeyError()
  return Buffer.from(v, "hex")
}

/** The two subkeys (HKDF-SHA-256, empty salt, one `info` per use). */
export function deriveKeys(master: Buffer): DerivedKeys {
  if (master.length !== 32) throw new CalendarKeyError()
  const sub = (info: string) => Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), info, 32))
  return { enc: sub("fulvia/calendar-sync/enc/v1"), mac: sub("fulvia/calendar-sync/state/v1") }
}

// ── AES-256-GCM ─────────────────────────────────────────────────────────────

const B64URL = /^[A-Za-z0-9_-]+$/
const IV_BYTES = 12
const TAG_BYTES = 16

/** Encrypt `plaintext`, bound to `aad` (e.g. "access:<userId>"). Fresh random IV every call. */
export function encryptSecret(enc: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", enc, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(aad, "utf8"))
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".")
}

/**
 * Decrypt a value of `encryptSecret`. Throws on a malformed value, a wrong
 * key, a different `aad` or any tampering (the GCM tag is always verified).
 * The error never carries the value.
 */
export function decryptSecret(enc: Buffer, stored: string, aad: string): string {
  const parts = stored.split(".")
  if (parts.length !== 4 || parts[0] !== "v1" || !parts.slice(1).every((p) => B64URL.test(p)))
    throw new Error("calendar-sync: malformed encrypted value")
  const iv = Buffer.from(parts[1], "base64url")
  const tag = Buffer.from(parts[2], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new Error("calendar-sync: malformed encrypted value")
  const decipher = createDecipheriv("aes-256-gcm", enc, iv, { authTagLength: TAG_BYTES })
  decipher.setAAD(Buffer.from(aad, "utf8"))
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new Error("calendar-sync: encrypted value failed authentication")
  }
}

/** Associated data of each encrypted column: the field and its owner. */
export const aadFor = {
  access: (userId: string) => `calendar-sync:access:${userId}`,
  refresh: (userId: string) => `calendar-sync:refresh:${userId}`,
  verifier: (nonce: string) => `calendar-sync:verifier:${nonce}`,
}

// ── OAuth state ─────────────────────────────────────────────────────────────

/** A fresh nonce: 32 random bytes, base64url (43 characters). */
export function newNonce(): string {
  return randomBytes(32).toString("base64url")
}

function stateMac(mac: Buffer, nonce: string, sessionId: string): Buffer {
  return createHmac("sha256", mac).update(`calendar-sync-state\n${nonce}\n${sessionId}`).digest()
}

/** "<nonce>.<mac>": the state sent to Google, bound to the session that started the flow. */
export function signState(mac: Buffer, nonce: string, sessionId: string): string {
  return `${nonce}.${stateMac(mac, nonce, sessionId).toString("base64url")}`
}

/**
 * The nonce of a state signed for THIS session, or null (wrong session,
 * tampered, malformed). Constant-time comparison. Single use is enforced by
 * the caller deleting the nonce's row.
 */
export function verifyState(mac: Buffer, state: string, sessionId: string): string | null {
  if (typeof state !== "string" || state.length > 200) return null
  const parts = state.split(".")
  if (parts.length !== 2 || !B64URL.test(parts[0]) || !B64URL.test(parts[1])) return null
  const [nonce, sig] = parts
  const got = Buffer.from(sig, "base64url")
  const want = stateMac(mac, nonce, sessionId)
  if (got.length !== want.length) return null
  return timingSafeEqual(got, want) ? nonce : null
}

// ── PKCE ────────────────────────────────────────────────────────────────────

/** RFC 7636: a 43-character verifier and its S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url")
  return { verifier, challenge: pkceChallenge(verifier) }
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url")
}

// ── Event ids and fingerprints ──────────────────────────────────────────────

const BASE32HEX = "0123456789abcdefghijklmnopqrstuv"

/**
 * Deterministic Google event id of a booking in a user's calendar. Google
 * accepts client ids of base32hex characters (a–v, 0–9), 5 to 1024 long,
 * unique per calendar (Calendar API v3, Events: insert, `id`):
 * https://developers.google.com/calendar/v3/reference/events/insert
 * Same booking + same user → same id, so a retried insert answers 409 instead
 * of creating a duplicate event.
 */
export function eventIdFor(bookingId: string, userId: string): string {
  const digest = createHash("sha256").update(`fulvia-booking\n${bookingId}\n${userId}`).digest()
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of digest) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32HEX[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32HEX[(value << (5 - bits)) & 31]
  return `fv${out}`
}

/** Hash of what the event shows: unchanged fingerprint = nothing to send. */
export function fingerprintOf(parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("base64url").slice(0, 32)
}
