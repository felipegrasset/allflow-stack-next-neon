import { sql, type Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"

import {
  dashboardSchema,
  type Dashboard,
  type DashboardInput,
} from "../contracts/definition"

export type SaveDashboardOptions = {
  /** Replace an existing dashboard with the same id (default: keep it, so user edits survive a re-seed). */
  overwrite?: boolean
  /** Order in the /reports list (ascending). */
  position?: number
  /** A Kysely instance (a seed's `db`, a transaction). Default: the app's pool. */
  db?: Kysely<Database>
}

/**
 * Validates and stores a dashboard. Server only. Idempotent: without
 * `overwrite`, an existing id is left untouched and `created` is false.
 * Throws ZodError if the definition is invalid.
 */
export async function saveDashboard(
  input: DashboardInput | Dashboard,
  options: SaveDashboardOptions = {}
): Promise<{ id: string; created: boolean }> {
  const def = dashboardSchema.parse(input)
  const db = options.db ?? getKysely()
  const json = JSON.stringify(def)
  const row = await db
    .insertInto("reports_dashboards")
    .values({ id: def.id, definition: json, position: options.position ?? 0 })
    .onConflict((oc) =>
      options.overwrite
        ? oc.column("id").doUpdateSet({ definition: json, updated_at: new Date() })
        : oc.column("id").doNothing()
    )
    // xmax = 0 only for a freshly inserted row (an upsert's update sets it).
    .returning(sql<boolean>`(xmax = 0)`.as("inserted"))
    .executeTakeFirst()
  // doNothing on a conflict returns no row at all.
  return { id: def.id, created: row?.inserted === true }
}
