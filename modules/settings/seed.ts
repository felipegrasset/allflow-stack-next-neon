import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * Invented sample values for two of the built-in settings. Idempotent: it
 * never overwrites a value the team already changed. `app.name` is left to
 * its default on purpose.
 */
const SAMPLE = [
  { key: "app.support_email", value: JSON.stringify("soporte@ejemplo.cl") },
  { key: "app.default_page_size", value: JSON.stringify(25) },
]

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto("settings")
    .values(SAMPLE.map((s) => ({ ...s, updated_by: null })))
    .onConflict((oc) => oc.column("key").doNothing())
    .execute()
}
