/**
 * Read-only queries over `payments`. They never write and never call a
 * provider: what they return is what the database already holds. To refresh a
 * payment against its provider use `syncPayment`.
 */
import { sql, type Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  listPaymentsInputSchema,
  type ListPaymentsInput,
  type PaymentsPage,
} from "../contracts/list"
import type { PaymentRecord } from "../contracts/types"

import { toRecord } from "./checkout"

type Db = Kysely<Database>

/** Microsecond-precision text of `created_at`, the cursor's first half. */
const cursorTs = sql<string>`to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

/**
 * Newest first, stable under ties (`created_at desc, id desc`). Reads
 * `limit + 1` rows to know whether there is a next page.
 */
export async function listPayments(
  db: Db,
  input: ListPaymentsInput = {}
): Promise<PaymentsPage> {
  const { status, provider, environment, cursor, limit } =
    listPaymentsInputSchema.parse(input)

  let query = db
    .selectFrom("payments")
    .selectAll()
    .select(cursorTs.as("cursor_ts"))

  if (status) query = query.where("status", "=", status)
  if (provider) query = query.where("provider", "=", provider)
  if (environment) query = query.where("environment", "=", environment)
  if (cursor) {
    const after = decodeCursor(cursor)
    if (!after) throw new InvalidCursorError()
    query = query.where(
      sql<boolean>`(created_at, id) < (${after.createdAt}::timestamptz, ${after.id})`
    )
  }

  const rows = await query
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1)
    .execute()

  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    items: page.map(({ cursor_ts: _cursorTs, ...row }) => toRecord(row)),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ createdAt: last.cursor_ts, id: last.id })
        : null,
  }
}

export async function getPayment(
  db: Db,
  paymentId: string
): Promise<PaymentRecord | null> {
  const row = await db
    .selectFrom("payments")
    .selectAll()
    .where("id", "=", paymentId)
    .executeTakeFirst()
  return row ? toRecord(row) : null
}
