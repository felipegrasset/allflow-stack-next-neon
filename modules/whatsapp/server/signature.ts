import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hex>`,
 * an HMAC-SHA256 of the RAW body keyed with the app secret. «Vía Fulvia»
 * uses the same scheme with WHATSAPP_FULVIA_WEBHOOK_SECRET (pending on the
 * platform side). No secret or no header → false: the webhook fails closed.
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string | null
): boolean {
  if (!secret || !header) return false
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim())
  if (!m) return false
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest()
  return timingSafeEqual(expected, Buffer.from(m[1], "hex"))
}

/** Constant-time string comparison (the GET verify token). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8")
  const y = Buffer.from(b, "utf8")
  return x.length === y.length && timingSafeEqual(x, y)
}

/** For tests and for whoever forwards payloads (the Fulvia side). */
export function signBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`
}
