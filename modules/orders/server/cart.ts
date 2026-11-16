import { cookies } from "next/headers"

import type { CartLine } from "../contracts/types"
import { CART_COOKIE, CART_MAX_AGE_SECONDS, decodeCart, encodeCart } from "./cart-codec"
import { cartSigningKey } from "./config"

/** The cart of this browser (ids and quantities only). Unsigned or broken → empty. */
export async function readCart(): Promise<CartLine[]> {
  const value = (await cookies()).get(CART_COOKIE)?.value
  return decodeCart(value, cartSigningKey())
}

/** Writes the cart (Server Actions only). False if it would not fit in a cookie. */
export async function writeCart(cart: readonly CartLine[]): Promise<boolean> {
  const jar = await cookies()
  if (cart.length === 0) {
    jar.delete(CART_COOKIE)
    return true
  }
  const value = encodeCart(cart, cartSigningKey())
  if (!value) return false
  jar.set(CART_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
  })
  return true
}

export async function clearCart(): Promise<void> {
  ;(await cookies()).delete(CART_COOKIE)
}
