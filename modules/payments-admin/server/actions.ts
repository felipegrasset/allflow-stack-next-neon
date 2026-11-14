"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  currencyExponent,
  getPaymentByOrder,
  refundPayment,
  syncPayment,
} from "@/modules/payments/contracts"

import { PAYMENTS_ADMIN_PATH } from "../contracts"
import { requirePaymentPermission } from "./access"
import { decideRefund, ORDER_ID_MAX, parseMajorAmount } from "./logic"
import { errorName, logAdmin } from "./log"

/**
 * The two Server Actions of the admin screen. Neither ever approves or
 * "simulates" a payment: `sync` asks the PROVIDER (with the server's key) and
 * applies what it says; `refund` asks the provider to refund. Every input is
 * re-validated here and every figure is re-read from the database: what the
 * browser sends is only "which payment" and "how much the person typed".
 *
 * Results are error CODES; the client turns them into text
 * (messages.ts → refund.errors / sync.failed).
 */

const target = z.object({
  orderId: z.string().trim().min(1).max(ORDER_ID_MAX),
  paymentId: z.string().trim().min(1).max(200),
})

const refundInput = target.extend({
  /** Major units as typed ("" = everything left). Parsed on the server. */
  amount: z.string().max(40),
  /** The refunded total the person saw: if the server's differs, the page is stale. */
  expectedRefundedMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export type SyncResult = { ok: true } | { ok: false; error: "invalid" | "not_found" | "failed" }

export async function syncPaymentAction(input: unknown): Promise<SyncResult> {
  const session = await requirePaymentPermission("read")
  const parsed = target.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const record = await getPaymentByOrder(parsed.data.orderId)
  if (!record || record.id !== parsed.data.paymentId)
    return { ok: false, error: "not_found" }
  try {
    const fresh = await syncPayment(record.id)
    logAdmin({ action: "sync", outcome: fresh.status, paymentId: record.id, actor: session.user.id })
  } catch (e) {
    logAdmin({ action: "sync", outcome: "error", paymentId: record.id, actor: session.user.id, error: errorName(e) })
    return { ok: false, error: "failed" }
  }
  revalidatePath(PAYMENTS_ADMIN_PATH)
  return { ok: true }
}

export type RefundError =
  | "invalid"
  | "format"
  | "decimals"
  | "zero"
  | "too_large"
  | "exceeds"
  | "stale"
  | "not_found"
  | "not_approved"
  | "nothing_left"
  | "provider"

export type RefundResult = { ok: true; refundMinor: number } | { ok: false; error: RefundError }

export async function refundPaymentAction(input: unknown): Promise<RefundResult> {
  const session = await requirePaymentPermission("refund")
  const parsed = refundInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { orderId, paymentId, amount, expectedRefundedMinor } = parsed.data

  const record = await getPaymentByOrder(orderId)
  let requestedMinor: number | undefined
  if (record && amount.trim() !== "") {
    const p = parseMajorAmount(amount, currencyExponent(record.currency))
    if (!p.ok) return { ok: false, error: p.error }
    requestedMinor = p.minor
  }
  const decision = decideRefund({ record, paymentId, expectedRefundedMinor, requestedMinor })
  if (!decision.ok) {
    logAdmin({ action: "refund", outcome: decision.error, paymentId, actor: session.user.id })
    return { ok: false, error: decision.error }
  }

  try {
    // payments re-checks: approved, provider reference, amount <= remaining.
    await refundPayment(paymentId, decision.amountArg)
  } catch (e) {
    logAdmin({
      action: "refund",
      outcome: "error",
      paymentId,
      actor: session.user.id,
      amountMinor: decision.refundMinor,
      error: errorName(e),
    })
    return { ok: false, error: "provider" }
  }
  logAdmin({
    action: "refund",
    outcome: "requested",
    paymentId,
    actor: session.user.id,
    amountMinor: decision.refundMinor,
  })
  revalidatePath(PAYMENTS_ADMIN_PATH)
  return { ok: true, refundMinor: decision.refundMinor }
}
