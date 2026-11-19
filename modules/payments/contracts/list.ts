/**
 * Read-only listing of payments: input schema, page type and the opaque cursor.
 * Pure (no database, no network) so it can be tested and imported anywhere.
 *
 * The cursor is `[created_at, id]` of the last row of the page, base64url. The
 * timestamp travels as TEXT with microseconds: a JS `Date` only keeps
 * milliseconds, and rounding it would skip or repeat rows that share one.
 */
import { z } from "zod"

import {
  PAYMENT_STATUSES,
  PROVIDER_IDS,
  type PaymentRecord,
} from "./types"

export const LIST_PAYMENTS_DEFAULT_LIMIT = 25
export const LIST_PAYMENTS_MAX_LIMIT = 100
const CURSOR_MAX_LENGTH = 400

export const listPaymentsInputSchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  cursor: z.string().min(1).max(CURSOR_MAX_LENGTH).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_PAYMENTS_MAX_LIMIT)
    .default(LIST_PAYMENTS_DEFAULT_LIMIT),
})
export type ListPaymentsInput = z.input<typeof listPaymentsInputSchema>

export type PaymentsPage = {
  items: PaymentRecord[]
  /** Pass it back as `cursor` for the next page; `null` on the last one. */
  nextCursor: string | null
}

export class InvalidCursorError extends Error {
  constructor() {
    super("Cursor de pagos inválido")
    this.name = "InvalidCursorError"
  }
}

export type PaymentsCursor = { createdAt: string; id: string }

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

export function encodeCursor(cursor: PaymentsCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.createdAt, cursor.id]),
    "utf8"
  ).toString("base64url")
}

/** `null` when the text is not a cursor this module issued. Never throws. */
export function decodeCursor(text: string): PaymentsCursor | null {
  if (text.length > CURSOR_MAX_LENGTH) return null
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(text, "base64url").toString("utf8")
    )
    if (!Array.isArray(parsed) || parsed.length !== 2) return null
    const [createdAt, id] = parsed as unknown[]
    if (typeof createdAt !== "string" || !TIMESTAMP.test(createdAt)) return null
    if (typeof id !== "string" || id.length === 0 || id.length > 200) return null
    return { createdAt, id }
  } catch {
    return null
  }
}
