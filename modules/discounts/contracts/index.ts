/**
 * The only thing another module (or the app) may import from `discounts`
 * (server side). Pure pieces are re-exported too; a client component imports
 * them from `@/modules/discounts/contracts/domain` / `/types`, and the code
 * form from `@/modules/discounts/contracts/ui`.
 *
 *   import { releaseDiscountForOrder, releaseStaleDiscounts } from "@/modules/discounts/contracts"
 *
 * None of these check session or permission: they are for server code that
 * already checked its own (a job, a webhook, an action).
 */
import { getKysely } from "@/server/db/pool"

import * as redeem from "../server/redeem"
import { defaultPorts } from "../server/ports"
import * as store from "../server/store"
import type { Redemption, ReleaseOutcome, SweepReport } from "./types"

/**
 * Call it after an order is canceled or expires: frees the code's use so it
 * counts again toward its caps (also confirms the use of a paid order).
 * Idempotent and safe in parallel; needs no session. Does nothing when the
 * order has no active use, or while it is still pending / in review.
 */
export const releaseDiscountForOrder = (orderId: string): Promise<ReleaseOutcome> =>
  redeem.releaseForOrder(getKysely(), defaultPorts, orderId)

/**
 * The sweep for a scheduled task: applies `releaseDiscountForOrder` to the
 * active, unconfirmed uses, least recently checked first (default 100, max
 * 1000). Counts only. Run it right after orders' `expirePendingOrders()`.
 */
export const releaseStaleDiscounts = (opts?: { limit?: number }): Promise<SweepReport> =>
  redeem.sweepStale(getKysely(), defaultPorts, opts)

/** The active use of an order (code, amount), or null. */
export const getActiveDiscount = (orderId: string): Promise<Redemption | null> =>
  store.activeRedemption(getKysely(), orderId)

/** Page where the buyer types a code for a pending order (`/orders/<id>/descuento`). */
export const discountPath = (orderId: string) => `/orders/${orderId}/descuento`
export const ADMIN_DISCOUNTS_PATH = "/admin/discounts"

export {
  applyDiscount,
  cappedAmount,
  codeState,
  discountRefOf,
  formatPercent,
  normalizeCode,
  parsePercent,
  rawAmount,
  rejectionError,
  releaseDecision,
  ruleProblems,
} from "./domain"
export * from "./types"
