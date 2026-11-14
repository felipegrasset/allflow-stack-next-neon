import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { usersDashboard } from "./demo"
import { saveDashboard } from "./server/save"

/** Stores the "usuarios" dashboard. Idempotent: an existing one (maybe edited) is kept. */
export async function seed(db: Kysely<Database>): Promise<void> {
  await saveDashboard(usersDashboard, { db, position: 0 })
}
