/** Database access with the Kysely instance injected, so it is easy to fake. */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "../db/types"
import { IMPORT_BATCH_SIZE, type ImportRow, type ImportTarget } from "../contracts/registry"

export type RunMeta = {
  userId: string | null
  fileName: string | null
  totalRows: number
  skippedRows: number
}

export type RunOutcome = { ok: true; imported: number } | { ok: false }

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Writes every row through `target.insert`, in batches, inside ONE transaction
 * together with the history row: if any batch throws, nothing is saved. The
 * failure is then recorded (outside the rolled-back transaction) with a stable
 * code and no cell values.
 */
export async function runImportWith(
  db: Kysely<Database>,
  target: ImportTarget,
  rows: readonly ImportRow[],
  meta: RunMeta
): Promise<RunOutcome> {
  const base = {
    target: target.id,
    file_name: meta.fileName ? meta.fileName.slice(0, 255) : null,
    total_rows: meta.totalRows,
    skipped_rows: meta.skippedRows,
    created_by: meta.userId,
  }
  try {
    await db.transaction().execute(async (trx) => {
      for (const batch of chunk(rows, IMPORT_BATCH_SIZE)) await target.insert(batch, { db: trx, userId: meta.userId })
      await trx
        .insertInto("csv_import_runs")
        .values({ id: randomUUID(), ...base, status: "done", imported_rows: rows.length, error_code: null })
        .execute()
    })
    return { ok: true, imported: rows.length }
  } catch (err) {
    console.error("[csv-import] import failed and was rolled back", err instanceof Error ? err.name : "error")
    try {
      await db
        .insertInto("csv_import_runs")
        .values({ id: randomUUID(), ...base, status: "failed", imported_rows: 0, error_code: "insert_failed" })
        .execute()
    } catch {
      // history is best effort
    }
    return { ok: false }
  }
}
