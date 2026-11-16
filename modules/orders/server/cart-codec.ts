/**
 * The cart cookie: `<payload>.<signature>`, both base64url. The payload is
 * `[[itemId, qty], …]` — ids and quantities ONLY (no prices, no names). The
 * signature is HMAC-SHA256 with a key derived from the app secret.
 *
 * Why a signed cookie and not a table: carts are anonymous (the store at
 * /productos and /carrito need no account), most are abandoned, and a cookie
 * costs no rows to clean up. Why signed when it only holds ids: so the cart is
 * only ever written by our own Server Actions (which validate every line), a
 * hand-edited cookie is dropped whole instead of half-parsed, and its size is
 * bounded. It is NOT what keeps prices honest: the server re-prices everything
 * from catalog at checkout (and under a row lock when creating the order).
 *
 * Pure (node:crypto only, no `@/`): tests import it directly.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

import { normalizeCart } from "../contracts/domain"
import type { CartLine } from "../contracts/types"

export const CART_COOKIE = "orders_cart"
export const CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
/** A cookie must stay under ~4 KB; 50 lines of 100-char ids would not, so cap the encoded value. */
export const CART_MAX_COOKIE_LENGTH = 3800

const KEY_LABEL = "fulvia-orders-cart-v1"

/** Derives the signing key from the app secret, so the raw secret is never used twice. */
export function cartKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(KEY_LABEL).digest()
}

const sign = (payload: string, key: Buffer) => createHmac("sha256", key).update(payload).digest("base64url")

/** Cart → cookie value, or null if it would not fit in a cookie. */
export function encodeCart(cart: readonly CartLine[], key: Buffer): string | null {
  const lines = normalizeCart(cart)
  const payload = Buffer.from(JSON.stringify(lines.map((l) => [l.itemId, l.qty]))).toString("base64url")
  const value = `${payload}.${sign(payload, key)}`
  return value.length <= CART_MAX_COOKIE_LENGTH ? value : null
}

/** Cookie value → cart. Missing, malformed or wrongly signed → empty cart (never a partial one). */
export function decodeCart(value: string | undefined | null, key: Buffer): CartLine[] {
  if (!value || value.length > CART_MAX_COOKIE_LENGTH) return []
  const dot = value.indexOf(".")
  if (dot <= 0 || dot !== value.lastIndexOf(".")) return []
  const payload = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1), "base64url")
  const expected = Buffer.from(sign(payload, key), "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return []
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  return normalizeCart(
    raw.map((t: unknown) => (Array.isArray(t) && t.length === 2 ? { itemId: t[0], qty: t[1] } : null))
  )
}
