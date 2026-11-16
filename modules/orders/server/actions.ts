"use server"

import { revalidatePath } from "next/cache"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getSellableItem, getSellableItems } from "@/modules/catalog/contracts"
import { getKysely } from "@/server/db/pool"

import { addToCart, setCartQty, shortOrderRef } from "../contracts/domain"
import {
  addToCartSchema,
  orderIdSchema,
  placeOrderSchema,
  setCartQtySchema,
  type AddToCartInput,
  type PlaceOrderInput,
  type SetCartQtyInput,
} from "../contracts/input"
import { OrderError, type OrderErrorCode } from "../contracts/types"
import { es } from "../messages"
import { readCart, writeCart, clearCart } from "./cart"
import { ordersTtlMinutes } from "./config"
import { actionSession, canOrder, canSeeOrder } from "./guard"
import { createOrder, fulfillOrder, releaseOrder, startOrderPayment } from "./lifecycle"
import { defaultPorts } from "./ports"
import { getOrder } from "./store"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and permission BEFORE touching data (the cart actions are public: they only
 * write this browser's cookie), (2) parses its input again with Zod, (3) only
 * then writes. No action accepts a price or an amount to charge.
 */

type Copy = Awaited<ReturnType<typeof getModuleCopy<typeof es>>>

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const ERROR_KEY: Record<OrderErrorCode, keyof Copy["errors"]> = {
  invalid_input: "invalidInput",
  empty_cart: "emptyCart",
  unavailable: "unavailable",
  mixed_currency: "mixedCurrency",
  insufficient_stock: "insufficientStock",
  prices_changed: "pricesChanged",
  not_found: "notFound",
  invalid_status: "invalidStatus",
  expired: "expired",
  payment_started: "paymentStarted",
  payment_conflict: "paymentConflict",
  payment_not_approved: "paymentNotApproved",
  invalid_discount: "invalidDiscount",
  zero_total: "zeroTotal",
  too_large: "tooLarge",
}

function failure(copy: Copy, e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof OrderError) return { ok: false, error: copy.errors[ERROR_KEY[e.code]] }
  console.error(`[orders] ${where} failed`, e instanceof Error ? e.name : "error")
  return { ok: false, error: copy.errors.generic }
}

function revalidateOrder(id: string) {
  revalidatePath(`/orders/${id}`)
  revalidatePath("/orders")
  revalidatePath("/admin/orders")
}

// ── cart (public: a cookie of this browser) ──────────────────────────────────

export async function addToCartAction(input: AddToCartInput): Promise<ActionResult> {
  const copy = await getModuleCopy(es)
  const parsed = addToCartSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: copy.errors.invalidInput }
  try {
    // Only sellable items enter the cart (a hint: checkout re-checks everything).
    if (!(await getSellableItem(parsed.data.itemId))) return { ok: false, error: copy.errors.notForSale }
    const change = addToCart(await readCart(), parsed.data.itemId, parsed.data.qty)
    if (!change.ok) return { ok: false, error: change.reason === "full" ? copy.errors.cartFull : copy.errors.invalidInput }
    if (!(await writeCart(change.cart))) return { ok: false, error: copy.errors.cartFull }
    revalidatePath("/carrito")
    return { ok: true, message: copy.cart.added }
  } catch (e) {
    return failure(copy, e, "addToCart")
  }
}

export async function setCartQtyAction(input: SetCartQtyInput): Promise<ActionResult> {
  const copy = await getModuleCopy(es)
  const parsed = setCartQtySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: copy.errors.invalidInput }
  try {
    const change = setCartQty(await readCart(), parsed.data.itemId, parsed.data.qty)
    if (!change.ok) return { ok: false, error: copy.errors.invalidInput }
    await writeCart(change.cart)
    revalidatePath("/carrito")
    revalidatePath("/checkout")
    return { ok: true }
  } catch (e) {
    return failure(copy, e, "setCartQty")
  }
}

/** Drops the lines whose item catalog no longer sells. */
export async function removeUnavailableAction(): Promise<ActionResult> {
  const copy = await getModuleCopy(es)
  try {
    const cart = await readCart()
    const sellable = new Set((await getSellableItems(cart.map((l) => l.itemId))).map((i) => i.id))
    await writeCart(cart.filter((l) => sellable.has(l.itemId)))
    revalidatePath("/carrito")
    return { ok: true }
  } catch (e) {
    return failure(copy, e, "removeUnavailable")
  }
}

// ── orders ───────────────────────────────────────────────────────────────────

export type PlaceOrderResult = { ok: true; redirectTo: string } | { ok: false; error: string }

/**
 * Creates the order from THIS browser's cart. The total is computed on the
 * server (lifecycle.createOrder); `expectedSubtotalMinor` is what the person
 * saw, only compared: if prices changed meanwhile, nothing is created.
 */
export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const session = await actionSession("/checkout", "read")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const parsed = placeOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: copy.errors.invalidInput }
  try {
    const order = await createOrder(getKysely(), defaultPorts, {
      userId: session.user.id,
      cart: await readCart(),
      expected: { subtotalMinor: parsed.data.expectedSubtotalMinor, currency: parsed.data.currency },
      ttlMinutes: ordersTtlMinutes(),
    })
    await clearCart()
    revalidatePath("/carrito")
    revalidatePath("/orders")
    revalidatePath("/admin/orders")
    return { ok: true, redirectTo: `/orders/${order.id}` }
  } catch (e) {
    return failure(copy, e, "placeOrder")
  }
}

export type PayResult = { ok: true; url: string } | { ok: true; message: string } | { ok: false; error: string }

/** Opens (or reuses) the provider's checkout for the buyer's own order. Amount = stored total. */
export async function payOrderAction(orderId: string): Promise<PayResult> {
  const session = await actionSession("/orders", "read")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const id = orderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, error: copy.errors.notFound }
  try {
    const res = await startOrderPayment(getKysely(), defaultPorts, id.data, {
      userId: session.user.id,
      ttlMinutes: ordersTtlMinutes(),
      description: copy.payDescription(shortOrderRef(id.data)),
    })
    revalidateOrder(id.data)
    if (res.kind === "redirect") return { ok: true, url: res.url }
    return { ok: true, message: res.kind === "paid" ? copy.detail.paidNotice : copy.detail.reviewNotice }
  } catch (e) {
    if (!(e instanceof OrderError)) {
      console.error("[orders] payOrder failed", e instanceof Error ? e.name : "error")
      return { ok: false, error: copy.errors.paymentsUnavailable }
    }
    return failure(copy, e, "payOrder")
  }
}

/** Buyer: own pending order. `order:manage`: any pending or under-review order. Never a paid one. */
export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const session = await actionSession("/orders", "read")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const id = orderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, error: copy.errors.notFound }
  try {
    const db = getKysely()
    const order = await getOrder(db, id.data)
    const canManage = await canOrder("manage")
    if (!order || !canSeeOrder({ userId: session.user.id, canManage }, order))
      return { ok: false, error: copy.errors.notFound }
    const r = await releaseOrder(db, defaultPorts, id.data, {
      kind: "cancel",
      actor: { kind: order.userId === session.user.id ? "buyer" : "staff", userId: session.user.id },
      asStaff: canManage,
    })
    revalidateOrder(id.data)
    if (r === "canceled") return { ok: true, message: copy.detail.canceledOk }
    if (r === "paid") return { ok: false, error: copy.detail.paidNotice }
    if (r === "review") return { ok: false, error: copy.detail.reviewNotice }
    return { ok: false, error: copy.errors.invalidStatus }
  } catch (e) {
    return failure(copy, e, "cancelOrder")
  }
}

/** `order:manage`: paid → fulfilled, re-checking the payment. */
export async function fulfillOrderAction(orderId: string): Promise<ActionResult> {
  const session = await actionSession("/admin/orders", "manage")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const id = orderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, error: copy.errors.notFound }
  try {
    await fulfillOrder(getKysely(), defaultPorts, id.data, { kind: "staff", userId: session.user.id })
    revalidateOrder(id.data)
    return { ok: true, message: copy.detail.fulfilledOk }
  } catch (e) {
    return failure(copy, e, "fulfillOrder")
  }
}
