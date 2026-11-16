/**
 * Zod schemas of what reaches the server from a browser (Server Actions are
 * reachable by direct POST, so each one parses again). Note what is NOT here:
 * no price, no total to charge, no name. `expectedSubtotalMinor` is only a
 * consistency check ("the total you saw is still the total"); the amount
 * charged is always the one the server computes. Pure: no `@/` imports.
 */
import { z } from "zod"

import { ORDER_ID, isItemId } from "./domain"
import { MAX_LINE_QTY, ORDER_STATUSES } from "./types"

const itemId = z.string().refine(isItemId)

export const addToCartSchema = z.object({
  itemId,
  qty: z.number().int().min(1).max(MAX_LINE_QTY),
})

/** qty 0 removes the line. */
export const setCartQtySchema = z.object({
  itemId,
  qty: z.number().int().min(0).max(MAX_LINE_QTY),
})

export const placeOrderSchema = z.object({
  expectedSubtotalMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
})

export const orderIdSchema = z.string().regex(ORDER_ID)

export const orderStatusSchema = z.enum(ORDER_STATUSES)

/**
 * What a discount writes on an order (`applyOrderDiscount`). Computed by the
 * discounts module ON THE SERVER; never a raw number from a form.
 * `amountMinor: 0` with `code: null` removes the discount.
 */
export const orderDiscountSchema = z.object({
  amountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  /** The code the person typed, for display ("VERANO10"). */
  code: z.string().trim().min(1).max(60).nullable(),
  /** The discount's own id/reference (e.g. `discount:<id>`), for audit. */
  ref: z.string().trim().min(1).max(200).nullable(),
})
export type OrderDiscountInput = z.infer<typeof orderDiscountSchema>

export type AddToCartInput = z.infer<typeof addToCartSchema>
export type SetCartQtyInput = z.infer<typeof setCartQtySchema>
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>
