/**
 * Web Push crypto with node:crypto only (the template has no `web-push`).
 * Pure functions: no env, no database, no network. Tested against the
 * examples of RFC 8291 (Section 5 / Appendix A) and RFC 8292 (Section 2.4)
 * in tests/push.test.ts.
 *
 * - VAPID (RFC 8292): an ES256 JWT (Section 2) sent as
 *   `Authorization: vapid t=<jwt>, k=<public key>` (Section 3, 3.1, 3.2).
 * - Message encryption (RFC 8291 on top of RFC 8188 "aes128gcm"): ECDH P-256
 *   + HKDF-SHA-256 + AES-128-GCM, one record per message (Sections 3.3, 3.4, 4).
 */
import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto"

// ── base64url ───────────────────────────────────────────────────────────────

const B64URL = /^[A-Za-z0-9_-]*$/

export function b64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url")
}

/** Strict base64url (no padding, no `+` or `/`). Throws on anything else. */
export function b64urlDecode(text: string): Uint8Array {
  if (!B64URL.test(text)) throw new Error("webpush: invalid base64url")
  return new Uint8Array(Buffer.from(text, "base64url"))
}

const utf8 = (s: string) => new Uint8Array(Buffer.from(s, "utf8"))
const concat = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts))

// ── keys ────────────────────────────────────────────────────────────────────

/** Uncompressed P-256 point: 0x04 || X(32) || Y(32). */
export function isUncompressedP256(key: Uint8Array): boolean {
  return key.length === 65 && key[0] === 0x04
}

/** The uncompressed public key of a raw 32-byte P-256 private key. */
export function publicKeyOf(privateKey: Uint8Array): Uint8Array {
  const ecdh = createECDH("prime256v1")
  ecdh.setPrivateKey(privateKey)
  return new Uint8Array(ecdh.getPublicKey())
}

export type VapidKeys = { publicKey: string; privateKey: string }

/** A fresh VAPID key pair, base64url (public: 65 bytes, private: 32 bytes). */
export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH("prime256v1")
  ecdh.generateKeys()
  const priv = Buffer.alloc(32)
  const raw = ecdh.getPrivateKey()
  raw.copy(priv, 32 - raw.length)
  return { publicKey: b64urlEncode(ecdh.getPublicKey()), privateKey: b64urlEncode(priv) }
}

/** True when a 65-byte uncompressed key is a valid P-256 point (rejects junk before storing it). */
export function publicKeyIsOnCurve(key: Uint8Array): boolean {
  if (!isUncompressedP256(key)) return false
  try {
    createPublicKey({ key: jwkFor(key), format: "jwk" })
    return true
  } catch {
    return false
  }
}

function jwkFor(publicKey: Uint8Array, privateKey?: Uint8Array) {
  if (!isUncompressedP256(publicKey)) throw new Error("webpush: public key must be 65 bytes, uncompressed")
  return {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(publicKey.subarray(1, 33)),
    y: b64urlEncode(publicKey.subarray(33, 65)),
    ...(privateKey ? { d: b64urlEncode(privateKey) } : {}),
  }
}

// ── VAPID (RFC 8292) ────────────────────────────────────────────────────────

/** RFC 8292 Section 2: "exp" MUST NOT be more than 24 hours from the request. */
export const VAPID_MAX_TTL_SECONDS = 24 * 60 * 60
export const VAPID_DEFAULT_TTL_SECONDS = 12 * 60 * 60

export type VapidInput = {
  /** Origin of the push service (the endpoint's scheme + host), RFC 8292 Section 2. */
  audience: string
  /** `mailto:` or `https:` contact, RFC 8292 Section 2.1. */
  subject: string
  publicKey: Uint8Array
  privateKey: Uint8Array
  /** Seconds since epoch; the JWT expires `ttlSeconds` after it. */
  nowSeconds: number
  ttlSeconds?: number
}

/** The signed ES256 JWT (RFC 8292 Section 2; JWS with the P1363 r||s signature, RFC 7518 3.4). */
export function vapidJwt(input: VapidInput): string {
  const ttl = Math.min(input.ttlSeconds ?? VAPID_DEFAULT_TTL_SECONDS, VAPID_MAX_TTL_SECONDS)
  const header = b64urlEncode(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64urlEncode(
    utf8(JSON.stringify({ aud: input.audience, exp: Math.floor(input.nowSeconds) + ttl, sub: input.subject }))
  )
  const signingInput = `${header}.${claims}`
  const key = createPrivateKey({ key: jwkFor(input.publicKey, input.privateKey), format: "jwk" })
  const sig = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" })
  return `${signingInput}.${b64urlEncode(sig)}`
}

/** The `Authorization` header value (RFC 8292 Section 3: scheme "vapid", params "t" 3.1 and "k" 3.2). */
export function vapidAuthorization(input: VapidInput): string {
  return `vapid t=${vapidJwt(input)}, k=${b64urlEncode(input.publicKey)}`
}

/** Checks an ES256 JWT signature against an uncompressed public key. Used by the tests. */
export function verifyVapidJwt(jwt: string, publicKey: Uint8Array): boolean {
  const parts = jwt.split(".")
  if (parts.length !== 3) return false
  try {
    const key = createPublicKey({ key: jwkFor(publicKey), format: "jwk" })
    return verify(
      "sha256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      { key, dsaEncoding: "ieee-p1363" },
      b64urlDecode(parts[2])
    )
  } catch {
    return false
  }
}

/** The decoded claims of a JWT (no verification). */
export function jwtClaims(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? ""
  return JSON.parse(Buffer.from(b64urlDecode(part)).toString("utf8")) as Record<string, unknown>
}

// ── aes128gcm (RFC 8291 + RFC 8188) ─────────────────────────────────────────

/** Record size written in the header (RFC 8291 Section 4: a single record, rs >= the record). */
export const RECORD_SIZE = 4096
/** salt(16) + rs(4) + idlen(1) + keyid(65): RFC 8188 Section 2.1 with RFC 8291 Section 4. */
export const HEADER_LENGTH = 86
const TAG_LENGTH = 16
/**
 * Largest plaintext that fits one 4096-byte record: rs - delimiter(1) - tag(16).
 * Push services also cap the whole body near 4 KB, so keep payloads small.
 */
export const MAX_PLAINTEXT = RECORD_SIZE - 1 - TAG_LENGTH

const hkdf = (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) =>
  new Uint8Array(hkdfSync("sha256", ikm, salt, info, length))

export type DerivedKeys = { ecdhSecret: Uint8Array; ikm: Uint8Array; cek: Uint8Array; nonce: Uint8Array }

/**
 * RFC 8291 Section 3.3 (combining the shared and authentication secrets) and
 * Section 3.4 (CEK and NONCE as in RFC 8188 Section 2.2 and 2.3).
 * HKDF here is extract-then-expand, exactly the RFC's PRK_key/IKM and PRK/CEK steps.
 */
export function deriveKeys(args: {
  ecdhSecret: Uint8Array
  authSecret: Uint8Array
  salt: Uint8Array
  uaPublic: Uint8Array
  asPublic: Uint8Array
}): DerivedKeys {
  // key_info = "WebPush: info" || 0x00 || ua_public || as_public (Section 3.4)
  const keyInfo = concat(utf8("WebPush: info\0"), args.uaPublic, args.asPublic)
  const ikm = hkdf(args.ecdhSecret, args.authSecret, keyInfo, 32)
  const cek = hkdf(ikm, args.salt, utf8("Content-Encoding: aes128gcm\0"), 16)
  const nonce = hkdf(ikm, args.salt, utf8("Content-Encoding: nonce\0"), 12)
  return { ecdhSecret: args.ecdhSecret, ikm, cek, nonce }
}

export type EncryptInput = {
  plaintext: Uint8Array
  /** The subscription's `keys.p256dh` (65 bytes). */
  uaPublic: Uint8Array
  /** The subscription's `keys.auth` (16 bytes). */
  authSecret: Uint8Array
  /** Only for tests (RFC vectors): fixed salt and application-server ECDH private key. */
  salt?: Uint8Array
  asPrivateKey?: Uint8Array
}

/**
 * The full `Content-Encoding: aes128gcm` body: header (salt, rs, keyid = the
 * ephemeral application-server public key) then one record, the plaintext +
 * the 0x02 last-record delimiter (RFC 8188 Section 2; RFC 8291 Section 4), no
 * extra padding. The ECDH key and salt are new on every call unless given.
 */
export function encryptPayload(input: EncryptInput): Uint8Array {
  if (!isUncompressedP256(input.uaPublic)) throw new Error("webpush: p256dh must be 65 bytes, uncompressed")
  if (input.authSecret.length !== 16) throw new Error("webpush: auth secret must be 16 bytes")
  if (input.plaintext.length > MAX_PLAINTEXT) throw new Error("webpush: payload too large")
  const salt = input.salt ?? new Uint8Array(randomBytes(16))
  if (salt.length !== 16) throw new Error("webpush: salt must be 16 bytes")

  const ecdh = createECDH("prime256v1")
  if (input.asPrivateKey) ecdh.setPrivateKey(input.asPrivateKey)
  else ecdh.generateKeys()
  const asPublic = new Uint8Array(ecdh.getPublicKey())
  const ecdhSecret = new Uint8Array(ecdh.computeSecret(input.uaPublic))
  const { cek, nonce } = deriveKeys({ ecdhSecret, authSecret: input.authSecret, salt, uaPublic: input.uaPublic, asPublic })

  const cipher = createCipheriv("aes-128-gcm", cek, nonce)
  const record = concat(
    new Uint8Array(cipher.update(concat(input.plaintext, Uint8Array.of(0x02)))),
    new Uint8Array(cipher.final()),
    new Uint8Array(cipher.getAuthTag())
  )
  const header = new Uint8Array(HEADER_LENGTH)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, record)
}

/**
 * The user agent's side (RFC 8291 Section 3.4 / RFC 8188 Section 2): parses
 * the header, derives the same keys and removes the padding. Exists so the
 * tests can check round trips and the RFC example; the app never decrypts.
 */
export function decryptPayload(args: {
  body: Uint8Array
  uaPrivateKey: Uint8Array
  authSecret: Uint8Array
}): Uint8Array {
  const { body } = args
  if (body.length < 21) throw new Error("webpush: body too short")
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  if (!isUncompressedP256(asPublic)) throw new Error("webpush: bad keyid")
  const ecdh = createECDH("prime256v1")
  ecdh.setPrivateKey(args.uaPrivateKey)
  const uaPublic = new Uint8Array(ecdh.getPublicKey())
  const ecdhSecret = new Uint8Array(ecdh.computeSecret(asPublic))
  const { cek, nonce } = deriveKeys({ ecdhSecret, authSecret: args.authSecret, salt, uaPublic, asPublic })
  const record = body.subarray(21 + idlen)
  if (record.length < TAG_LENGTH + 1) throw new Error("webpush: record too short")
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce)
  decipher.setAuthTag(record.subarray(record.length - TAG_LENGTH))
  const padded = concat(
    new Uint8Array(decipher.update(record.subarray(0, record.length - TAG_LENGTH))),
    new Uint8Array(decipher.final())
  )
  let end = padded.length - 1
  while (end >= 0 && padded[end] === 0) end--
  if (end < 0 || padded[end] !== 0x02) throw new Error("webpush: bad padding delimiter")
  return padded.subarray(0, end)
}
