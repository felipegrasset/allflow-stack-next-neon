/**
 * GET /api/export/<id>, with every dependency injected so the tests run it
 * without Next, Better Auth or a database. server/wire.ts wires the real ones.
 *
 * Order: session (401) -> destination (404) -> permission (403) -> query ->
 * CSV. The query never runs for someone who may not export.
 */
import { csvResponse, safeFileName, toCsv } from "./csv"
import {
  DEFAULT_MAX_ROWS,
  EXPORT_ID,
  isValidPermission,
  type ExportContext,
  type ExportDestination,
} from "./registry"

import type { ModuleStatement } from "../../contract/types"

export const EXPORT_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "too_many_rows",
  "failed",
] as const
export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number]

const STATUS: Record<ExportErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  too_many_rows: 413,
  failed: 500,
}

export function errorResponse(code: ExportErrorCode): Response {
  return Response.json(
    { error: code },
    { status: STATUS[code], headers: { "cache-control": "no-store" } }
  )
}

export type ExportDeps = {
  session: () => Promise<{ userId: string } | null>
  can: (permission: ModuleStatement) => Promise<boolean>
  find: (id: string) => ExportDestination<unknown> | undefined
  now?: () => Date
  log?: (msg: string, err: unknown) => void
}

export async function handleExport(
  id: string,
  req: Request,
  deps: ExportDeps
): Promise<Response> {
  let session: { userId: string } | null
  try {
    session = await deps.session()
  } catch (err) {
    deps.log?.("export: session lookup failed", err)
    return errorResponse("unauthorized")
  }
  if (!session) return errorResponse("unauthorized")

  if (!EXPORT_ID.test(id)) return errorResponse("not_found")
  const dest = deps.find(id)
  if (!dest) return errorResponse("not_found")

  // Fail closed: a destination without a usable permission is never served.
  if (!isValidPermission(dest.permission)) return errorResponse("forbidden")
  let allowed = false
  try {
    allowed = await deps.can(dest.permission)
  } catch (err) {
    deps.log?.("export: permission check failed", err)
  }
  if (!allowed) return errorResponse("forbidden")

  const ctx: ExportContext = {
    userId: session.userId,
    request: req,
    searchParams: new URL(req.url).searchParams,
  }
  try {
    const data = await dest.query(ctx)
    if (data.rows.length > (dest.maxRows ?? DEFAULT_MAX_ROWS))
      return errorResponse("too_many_rows")
    const csv = toCsv(data.rows, data.columns, {
      delimiter: dest.delimiter,
      bom: dest.bom ?? true,
    })
    const day = (deps.now?.() ?? new Date()).toISOString().slice(0, 10)
    const wanted =
      typeof dest.filename === "function" ? dest.filename(ctx) : dest.filename
    return csvResponse(csv, {
      filename: safeFileName(wanted ?? `${dest.id}-${day}`, dest.id),
    })
  } catch (err) {
    deps.log?.(`export: ${dest.id} failed`, err)
    return errorResponse("failed")
  }
}
