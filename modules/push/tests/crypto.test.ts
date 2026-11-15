/**
 * push — the crypto, against the published examples:
 * - RFC 8291 Section 5 (example) and Appendix A (intermediate values): the
 *   encryption with the example's fixed salt and keys must give the RFC's
 *   exact body, and decrypting that body must give the RFC's plaintext.
 * - RFC 8292 Section 2.4 (Figure 1/2): the example JWT must verify with the
 *   example "k" key; our own JWTs must verify and respect the 24 h "exp" cap
 *   of Section 2.
 * Pure: no database, no network.
 */
import assert from "node:assert/strict"
import { createECDH } from "node:crypto"
import test from "node:test"

import {
  b64urlDecode,
  b64urlEncode,
  decryptPayload,
  deriveKeys,
  encryptPayload,
  generateVapidKeys,
  HEADER_LENGTH,
  jwtClaims,
  MAX_PLAINTEXT,
  publicKeyOf,
  vapidAuthorization,
  vapidJwt,
  verifyVapidJwt,
} from "../server/crypto/webpush"

const d = b64urlDecode
const text = (b: Uint8Array) => Buffer.from(b).toString("utf8")

// RFC 8291, Section 5 and Appendix A.
const RFC8291 = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  ecdhSecret: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
}

// RFC 8292, Section 2.4 (Figure 1 and Figure 2).
const RFC8292 = {
  jwt:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA",
  k: "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs",
}

test("RFC 8291 A: the example key pairs are consistent", () => {
  assert.equal(b64urlEncode(publicKeyOf(d(RFC8291.asPrivate))), RFC8291.asPublic)
  assert.equal(b64urlEncode(publicKeyOf(d(RFC8291.uaPrivate))), RFC8291.uaPublic)
})

test("RFC 8291 3.3/3.4 + A: ECDH secret, IKM, CEK and NONCE match the appendix", () => {
  const body = encryptPayload({
    plaintext: d(RFC8291.plaintext),
    uaPublic: d(RFC8291.uaPublic),
    authSecret: d(RFC8291.authSecret),
    salt: d(RFC8291.salt),
    asPrivateKey: d(RFC8291.asPrivate),
  })
  assert.ok(body.length > HEADER_LENGTH)
  // Recompute the intermediate values from the same inputs.
  const ecdh = createECDH("prime256v1")
  ecdh.setPrivateKey(d(RFC8291.asPrivate))
  const ecdhSecret = new Uint8Array(ecdh.computeSecret(d(RFC8291.uaPublic)))
  assert.equal(b64urlEncode(ecdhSecret), RFC8291.ecdhSecret)
  const k = deriveKeys({
    ecdhSecret,
    authSecret: d(RFC8291.authSecret),
    salt: d(RFC8291.salt),
    uaPublic: d(RFC8291.uaPublic),
    asPublic: d(RFC8291.asPublic),
  })
  assert.equal(b64urlEncode(k.ikm), RFC8291.ikm)
  assert.equal(b64urlEncode(k.cek), RFC8291.cek)
  assert.equal(b64urlEncode(k.nonce), RFC8291.nonce)
})

test("RFC 8291 Section 5: encrypting the example gives the RFC's exact body", () => {
  const body = encryptPayload({
    plaintext: d(RFC8291.plaintext),
    uaPublic: d(RFC8291.uaPublic),
    authSecret: d(RFC8291.authSecret),
    salt: d(RFC8291.salt),
    asPrivateKey: d(RFC8291.asPrivate),
  })
  assert.equal(b64urlEncode(body), RFC8291.body)
})

test("RFC 8291 Section 5: decrypting the RFC's body gives the example plaintext", () => {
  const plain = decryptPayload({
    body: d(RFC8291.body),
    uaPrivateKey: d(RFC8291.uaPrivate),
    authSecret: d(RFC8291.authSecret),
  })
  assert.equal(text(plain), "When I grow up, I want to be a watermelon")
})

test("aes128gcm: round trip with random salt and ephemeral key; tampering fails", () => {
  const ua = generateVapidKeys() // any P-256 pair works as a user-agent key
  const auth = new Uint8Array(16).fill(7)
  const msg = new TextEncoder().encode(JSON.stringify({ title: "Hola", body: "ñandú ✓" }))
  const a = encryptPayload({ plaintext: msg, uaPublic: d(ua.publicKey), authSecret: auth })
  const b = encryptPayload({ plaintext: msg, uaPublic: d(ua.publicKey), authSecret: auth })
  assert.notEqual(b64urlEncode(a), b64urlEncode(b), "salt and key are fresh each time")
  assert.deepEqual(decryptPayload({ body: a, uaPrivateKey: d(ua.privateKey), authSecret: auth }), msg)
  const bad = new Uint8Array(a)
  bad[bad.length - 1] ^= 1
  assert.throws(() => decryptPayload({ body: bad, uaPrivateKey: d(ua.privateKey), authSecret: auth }))
  const wrongAuth = new Uint8Array(16).fill(8)
  assert.throws(() => decryptPayload({ body: a, uaPrivateKey: d(ua.privateKey), authSecret: wrongAuth }))
})

test("aes128gcm: rejects bad keys and oversized payloads", () => {
  const ua = generateVapidKeys()
  const auth = new Uint8Array(16)
  assert.throws(() => encryptPayload({ plaintext: new Uint8Array(1), uaPublic: new Uint8Array(33), authSecret: auth }))
  assert.throws(() =>
    encryptPayload({ plaintext: new Uint8Array(1), uaPublic: d(ua.publicKey), authSecret: new Uint8Array(8) })
  )
  assert.throws(() =>
    encryptPayload({ plaintext: new Uint8Array(MAX_PLAINTEXT + 1), uaPublic: d(ua.publicKey), authSecret: auth })
  )
  assert.doesNotThrow(() =>
    encryptPayload({ plaintext: new Uint8Array(MAX_PLAINTEXT), uaPublic: d(ua.publicKey), authSecret: auth })
  )
})

test("RFC 8292 Section 2.4: the example JWT verifies with the example key", () => {
  assert.equal(verifyVapidJwt(RFC8292.jwt, d(RFC8292.k)), true)
  assert.deepEqual(jwtClaims(RFC8292.jwt), {
    aud: "https://push.example.net",
    exp: 1453523768,
    sub: "mailto:push@example.com",
  })
  // A changed claim breaks the signature.
  const [h, , s] = RFC8292.jwt.split(".")
  const forged = `${h}.${b64urlEncode(new TextEncoder().encode('{"aud":"https://evil.example","exp":1453523768,"sub":"mailto:push@example.com"}'))}.${s}`
  assert.equal(verifyVapidJwt(forged, d(RFC8292.k)), false)
})

test("RFC 8292 Sections 2, 3: our JWT verifies, exp is capped at 24 h, header has t and k", () => {
  const keys = generateVapidKeys()
  const base = {
    audience: "https://fcm.googleapis.com",
    subject: "mailto:soporte@ejemplo.cl",
    publicKey: d(keys.publicKey),
    privateKey: d(keys.privateKey),
    nowSeconds: 1_800_000_000,
  }
  const jwt = vapidJwt(base)
  assert.equal(verifyVapidJwt(jwt, d(keys.publicKey)), true)
  assert.deepEqual(JSON.parse(text(d(jwt.split(".")[0]))), { typ: "JWT", alg: "ES256" })
  assert.deepEqual(jwtClaims(jwt), { aud: base.audience, exp: base.nowSeconds + 12 * 3600, sub: base.subject })
  assert.equal(jwtClaims(vapidJwt({ ...base, ttlSeconds: 99 * 3600 })).exp, base.nowSeconds + 24 * 3600)
  const other = generateVapidKeys()
  assert.equal(verifyVapidJwt(jwt, d(other.publicKey)), false)
  const header = vapidAuthorization(base)
  assert.match(header, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/)
  assert.ok(header.endsWith(`k=${keys.publicKey}`))
})

test("base64url: strict decoding", () => {
  assert.throws(() => b64urlDecode("ab+c"))
  assert.throws(() => b64urlDecode("abc="))
  assert.equal(b64urlEncode(b64urlDecode("AQID")), "AQID")
})
