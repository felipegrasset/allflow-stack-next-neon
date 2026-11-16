/**
 * Zod schemas of what reaches the server from a browser (Server Actions are
 * reachable by direct POST, so each one parses again). Note what is NOT here
 * for the buyer: no amount, no total, no percentage. The buyer sends a code
 * and an order id; the discount is computed on the server from the STORED
 * order. Pure: no `@/` imports (catalog's money helpers are pure too).
 */
import { z } from "zod"

import { MAX_AMOUNT_MINOR, parseAmount } from "../../catalog/contracts/money"
import { parsePercent, ruleProblems, type RuleProblem } from "./domain"
import { DISCOUNT_KINDS, type DiscountKind } from "./types"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const orderIdSchema = z.string().regex(UUID)
export const codeIdSchema = z.string().regex(UUID)

/** Buyer: apply a code to their own pending order. The code is normalised later (`normalizeCode`). */
export const redeemSchema = z.object({
  orderId: orderIdSchema,
  code: z.string().max(200),
})
export type RedeemInput = z.infer<typeof redeemSchema>

/** Buyer: remove the code of their own pending order. */
export const removeSchema = z.object({ orderId: orderIdSchema })
export type RemoveInput = z.infer<typeof removeSchema>

// ── admin ────────────────────────────────────────────────────────────────────

const text = (max: number) => z.string().max(max)
/** An ISO instant from the browser (it converts its local time), or "" for none. */
const instant = z.union([z.literal(""), z.iso.datetime({ offset: true })])
/** A whole number typed in a form, or "" for none. */
const count = z.union([z.literal(""), z.string().regex(/^\d{1,7}$/)])

/**
 * The code form, as typed. Amounts arrive as TEXT and are parsed on the server
 * with the code's currency (`parseAmount`: no floating point), the percentage
 * with `parsePercent`. `toCodeData` turns it into the stored shape.
 */
export const codeFormSchema = z.object({
  kind: z.enum(DISCOUNT_KINDS),
  percent: text(10),
  amount: text(30),
  currency: z.union([z.literal(""), z.string().regex(/^[A-Za-z]{3}$/)]),
  minSubtotal: text(30),
  startsAt: instant,
  endsAt: instant,
  maxUses: count,
  maxUsesPerUser: count,
  note: text(200),
})
export type CodeFormInput = z.infer<typeof codeFormSchema>

export const createCodeSchema = codeFormSchema.extend({ code: z.string().max(200), active: z.boolean() })
export type CreateCodeInput = z.infer<typeof createCodeSchema>

export const updateCodeSchema = codeFormSchema.extend({ codeId: codeIdSchema })
export type UpdateCodeInput = z.infer<typeof updateCodeSchema>

export const setActiveSchema = z.object({ codeId: codeIdSchema, active: z.boolean() })
export type SetActiveInput = z.infer<typeof setActiveSchema>

/** What is stored for a code (besides its id, code text, active flag and audit fields). */
export type CodeData = {
  kind: DiscountKind
  percentBp: number | null
  amountMinor: number | null
  currency: string | null
  minSubtotalMinor: number | null
  startsAt: Date | null
  endsAt: Date | null
  maxUses: number | null
  maxUsesPerUser: number | null
  note: string | null
}

export type CodeField = keyof CodeFormInput
export type CodeDataResult =
  | { ok: true; data: CodeData }
  | { ok: false; fields: Partial<Record<CodeField, "invalid" | RuleProblem>> }

const opt = (s: string) => (s.trim() === "" ? null : s.trim())

/**
 * Form → stored shape, or which fields are wrong. Percent codes ignore the
 * amount field and vice versa. Zero caps are refused (use "inactive").
 */
export function toCodeData(input: CodeFormInput): CodeDataResult {
  const fields: Partial<Record<CodeField, "invalid" | RuleProblem>> = {}
  const currency = opt(input.currency)?.toUpperCase() ?? null
  let percentBp: number | null = null
  let amountMinor: number | null = null
  if (input.kind === "percent") {
    percentBp = opt(input.percent) === null ? null : parsePercent(input.percent)
    if (opt(input.percent) !== null && percentBp === null) fields.percent = "invalid"
  } else if (opt(input.amount) !== null) {
    amountMinor = currency ? parseAmount(input.amount, currency) : null
    if (currency && (amountMinor === null || amountMinor < 1 || amountMinor > MAX_AMOUNT_MINOR)) fields.amount = "invalid"
  }
  let minSubtotalMinor: number | null = null
  if (opt(input.minSubtotal) !== null && currency) {
    minSubtotalMinor = parseAmount(input.minSubtotal, currency)
    if (minSubtotalMinor === null || minSubtotalMinor < 1) fields.minSubtotal = "invalid"
  }
  const capOf = (s: string, k: "maxUses" | "maxUsesPerUser") => {
    if (s === "") return null
    const n = Number(s)
    if (n < 1) fields[k] = "invalid"
    return n
  }
  const data: CodeData = {
    kind: input.kind,
    percentBp,
    amountMinor,
    currency,
    // Typed without a currency: kept as a marker so ruleProblems asks for the currency.
    minSubtotalMinor: opt(input.minSubtotal) !== null && !currency ? 1 : minSubtotalMinor,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    maxUses: capOf(input.maxUses, "maxUses"),
    maxUsesPerUser: capOf(input.maxUsesPerUser, "maxUsesPerUser"),
    note: opt(input.note),
  }
  for (const p of ruleProblems(data)) {
    if (p === "percent_required") fields.percent ??= p
    else if (p === "amount_required") fields.amount ??= p
    else if (p === "currency_required") fields.currency ??= p
    else if (p === "dates_order") fields.endsAt ??= p
    else fields.maxUsesPerUser ??= p
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, data }
}
