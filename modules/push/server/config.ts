/**
 * VAPID configuration from the environment. Pure: takes the env as an
 * argument. Keys are base64url, as `web-push generate-vapid-keys` or
 * `generateVapidKeys()` (server/crypto/webpush.ts) print them.
 */
import { b64urlDecode, isUncompressedP256, publicKeyOf } from "./crypto/webpush"

export type Env = Record<string, string | undefined>

export type VapidConfig = {
  publicKey: Uint8Array
  privateKey: Uint8Array
  /** The public key as given (base64url): what the browser needs as `applicationServerKey`. */
  publicKeyText: string
  /** `mailto:` or `https:` contact for the push services (RFC 8292 Section 2.1). */
  subject: string
}

export type VapidConfigError =
  | "missing"
  | "invalid_public_key"
  | "invalid_private_key"
  | "key_mismatch"
  | "invalid_subject"

export type VapidConfigResult = { ok: true; config: VapidConfig } | { ok: false; error: VapidConfigError }

function decode(text: string): Uint8Array | null {
  try {
    return b64urlDecode(text)
  } catch {
    return null
  }
}

export function isValidSubject(subject: string): boolean {
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(subject)) return true
  try {
    const u = new URL(subject)
    return u.protocol === "https:" && u.hostname !== "localhost"
  } catch {
    return false
  }
}

export function readVapidConfig(env: Env = process.env): VapidConfigResult {
  const publicKeyText = env.VAPID_PUBLIC_KEY?.trim() ?? ""
  const privateText = env.VAPID_PRIVATE_KEY?.trim() ?? ""
  const subject = env.VAPID_SUBJECT?.trim() ?? ""
  if (!publicKeyText || !privateText || !subject) return { ok: false, error: "missing" }
  const publicKey = decode(publicKeyText)
  if (!publicKey || !isUncompressedP256(publicKey)) return { ok: false, error: "invalid_public_key" }
  const privateKey = decode(privateText)
  if (!privateKey || privateKey.length !== 32) return { ok: false, error: "invalid_private_key" }
  let derived: Uint8Array
  try {
    derived = publicKeyOf(privateKey)
  } catch {
    return { ok: false, error: "invalid_private_key" }
  }
  if (Buffer.compare(Buffer.from(derived), Buffer.from(publicKey)) !== 0) return { ok: false, error: "key_mismatch" }
  if (!isValidSubject(subject)) return { ok: false, error: "invalid_subject" }
  return { ok: true, config: { publicKey, privateKey, publicKeyText, subject } }
}
