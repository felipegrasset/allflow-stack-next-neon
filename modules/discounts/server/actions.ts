"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { clientIp, consume } from "@/server/rate-limit"
import { getSession } from "@/server/session"

import { redeemSchema, removeSchema, type RedeemInput, type RemoveInput } from "../contracts/input"
import { es } from "../messages"
import { safeLog } from "./log"
import { discountPagePath, orderPagePath } from "./paths"
import { defaultPorts } from "./ports"
import { redeemCode, removeDiscount, toDiscountError } from "./redeem"
import { fail } from "./result"

/** Per visitor (IP) and per person: guessing codes is slow. */
const PER_IP = { max: 10, windowMs: 60_000 }
const PER_USER = { max: 30, windowMs: 3_600_000 }

/**
 * The buyer's code actions. Reachable by direct POST, so each one: (1) needs a
 * session (no session → the same answer whatever the code: nothing about
 * codes is revealed), (2) is rate limited per IP and per person BEFORE
 * looking at any code, (3) validates the input with Zod, (4) lets
 * server/redeem.ts check that the order is the person's, pending and unpaid,
 * and compute the amount from the stored order. The browser never sends an
 * amount.
 */
async function guard(): Promise<{ userId: string } | { denied: FormResult<"code"> }> {
  const session = await getSession()
  if (!session) return { denied: await fail("unauthenticated") }
  const ip = await clientIp()
  const byIp = await consume(`discounts:redeem:ip:${ip}`, PER_IP)
  if (!byIp.ok) return { denied: await fail("rate_limited") }
  const byUser = await consume(`discounts:redeem:user:${session.user.id}`, PER_USER)
  if (!byUser.ok) return { denied: await fail("rate_limited") }
  return { userId: session.user.id }
}

function refresh(orderId: string) {
  revalidatePath(orderPagePath(orderId))
  revalidatePath(discountPagePath(orderId))
}

export async function redeemCodeAction(values: RedeemInput): Promise<FormResult<"code">> {
  const g = await guard()
  if ("denied" in g) return g.denied
  const parsed = redeemSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_code")
  try {
    const r = await redeemCode(getKysely(), defaultPorts, {
      orderId: parsed.data.orderId,
      userId: g.userId,
      code: parsed.data.code,
    })
    refresh(parsed.data.orderId)
    const copy = await getModuleCopy(es)
    const message = r.unchanged
      ? copy.redeem.unchanged
      : r.replaced
        ? copy.redeem.replaced(r.code)
        : copy.redeem.applied(r.code)
    return { ok: true, message }
  } catch (err) {
    const code = toDiscountError(err)
    if (code === "unknown") safeLog("redeem", err)
    return fail(code)
  }
}

export async function removeDiscountAction(values: RemoveInput): Promise<FormResult<"code">> {
  const session = await getSession()
  if (!session) return fail("unauthenticated")
  const parsed = removeSchema.safeParse(values)
  if (!parsed.success) return fail("order_not_found")
  try {
    await removeDiscount(getKysely(), defaultPorts, { orderId: parsed.data.orderId, userId: session.user.id })
    refresh(parsed.data.orderId)
    const copy = await getModuleCopy(es)
    return { ok: true, message: copy.redeem.removed }
  } catch (err) {
    const code = toDiscountError(err)
    if (code === "unknown") safeLog("remove", err)
    return fail(code)
  }
}
