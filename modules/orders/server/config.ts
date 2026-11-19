import { pendingTtlMinutes } from "../contracts/domain"
import { cartKey } from "./cart-codec"

/** Minutes a pending order keeps its stock (`ORDERS_PENDING_TTL_MINUTES`, default 30, 5–10080). */
export const ordersTtlMinutes = (env: NodeJS.ProcessEnv = process.env) => pendingTtlMinutes(env.ORDERS_PENDING_TTL_MINUTES)

let warned = false

/**
 * Key that signs the cart cookie, derived from `BETTER_AUTH_SECRET` (the app
 * already requires it). In production without it the cart refuses to work
 * (fails closed). In development a fixed, public key is used and a warning is
 * printed: carts are not worth protecting there.
 */
export function cartSigningKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = env.BETTER_AUTH_SECRET
  if (secret && secret.length >= 16) return cartKey(secret)
  if (env.NODE_ENV === "production") throw new Error("orders: BETTER_AUTH_SECRET is required to sign the cart")
  if (!warned) {
    warned = true
    console.warn("[orders] BETTER_AUTH_SECRET missing: the cart cookie uses a development key")
  }
  return cartKey("orders-development-only-key")
}
