import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * Two invented runs of a made-up target so the history is not empty on a fresh
 * app. Fixed ids: running it again does nothing.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const day = 24 * 3600 * 1000
  const now = Date.now()
  await db
    .insertInto("csv_import_runs")
    .values([
      {
        id: "csv-import-seed-1",
        target: "contactos",
        file_name: "contactos-octubre.csv",
        status: "done",
        total_rows: 120,
        imported_rows: 118,
        skipped_rows: 2,
        error_code: null,
        created_by: null,
        created_at: new Date(now - 3 * day),
      },
      {
        id: "csv-import-seed-2",
        target: "contactos",
        file_name: "contactos-noviembre.csv",
        status: "failed",
        total_rows: 40,
        imported_rows: 0,
        skipped_rows: 0,
        error_code: "insert_failed",
        created_by: null,
        created_at: new Date(now - day),
      },
    ])
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()
}
