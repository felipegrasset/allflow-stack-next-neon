import { getKysely } from "@/server/db/pool"

import "../db/types"

export const RUNS_LIMIT = 20

export type RunRow = {
  id: string
  target: string
  fileName: string | null
  status: "done" | "failed"
  importedRows: number
  skippedRows: number
  createdAt: Date
  createdByName: string | null
}

/** The latest runs. The caller checks `import:run`. */
export async function listRecentRuns(): Promise<RunRow[]> {
  const rows = await getKysely()
    .selectFrom("csv_import_runs as r")
    .leftJoin("user as u", "u.id", "r.created_by")
    .select([
      "r.id",
      "r.target",
      "r.file_name",
      "r.status",
      "r.imported_rows",
      "r.skipped_rows",
      "r.created_at",
      "u.name as created_by_name",
    ])
    .orderBy("r.created_at", "desc")
    .limit(RUNS_LIMIT)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    target: r.target,
    fileName: r.file_name,
    status: r.status === "done" ? "done" : "failed",
    importedRows: r.imported_rows,
    skippedRows: r.skipped_rows,
    createdAt: r.created_at,
    createdByName: r.created_by_name,
  }))
}
