import { sql } from "kysely"

import { getKysely } from "@/server/db/pool"

import { dashboardSchema, type Dashboard } from "../contracts/definition"

/**
 * Reads the stored definition under a row lock, applies `edit` and stores the
 * re-validated result. Returns whether something changed.
 */
export async function editDashboard(
  id: string,
  edit: (d: Dashboard) => Dashboard | null
): Promise<boolean> {
  return getKysely()
    .transaction()
    .execute(async (trx) => {
      const row = await trx
        .selectFrom("reports_dashboards")
        .select("definition")
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst()
      if (!row) return false
      const current = dashboardSchema.safeParse(row.definition)
      if (!current.success) return false
      const next = edit(current.data)
      if (!next) return false
      const valid = dashboardSchema.parse(next)
      await trx
        .updateTable("reports_dashboards")
        .set({ definition: JSON.stringify(valid), updated_at: sql<Date>`now()` })
        .where("id", "=", id)
        .execute()
      return true
    })
}
