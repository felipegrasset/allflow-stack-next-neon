/**
 * Export destinations. A module that owns a listing registers it once:
 *
 *   registerExport({
 *     id: "tickets",
 *     permission: { ticket: ["manage"] },      // who may download it
 *     query: async ({ searchParams }) => ({ rows: await listTickets(), columns: [...] }),
 *   })
 *
 * The permission is declared by the registrant and is REQUIRED: a destination
 * without one is refused at registration, so nothing is exported by default.
 * The registry lives on `globalThis`, so every copy of this file in the same
 * server process sees the same destinations.
 */
import type { ModuleStatement } from "../../contract/types"

import type { CsvColumn } from "./csv"

export type ExportContext = {
  userId: string
  request: Request
  /** The query string of the request: the destination validates it itself. */
  searchParams: URLSearchParams
}

export type ExportData<Row> = {
  rows: readonly Row[]
  columns: readonly CsvColumn<Row>[]
}

export type ExportDestination<Row = Record<string, unknown>> = {
  /** `[a-z0-9][a-z0-9_.-]{0,63}`; becomes /api/export/<id>. */
  id: string
  /** Every resource:action pair the person must hold (Better Auth, static and dynamic roles). */
  permission: ModuleStatement
  /** Runs only after the session and the permission were checked. */
  query: (ctx: ExportContext) => Promise<ExportData<Row>> | ExportData<Row>
  /** File name (without path); default `<id>-YYYY-MM-DD.csv`. */
  filename?: string | ((ctx: ExportContext) => string)
  /** Default `,`. */
  delimiter?: "," | ";"
  /** Default true here (Excel); `toCsv` itself defaults to false. */
  bom?: boolean
  /** More rows than this answers 413 instead of truncating. Default 50 000. */
  maxRows?: number
}

export const DEFAULT_MAX_ROWS = 50_000
export const EXPORT_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/

/** True when `permission` names at least one action and no empty entries. */
export function isValidPermission(permission: unknown): permission is ModuleStatement {
  if (!permission || typeof permission !== "object" || Array.isArray(permission))
    return false
  const entries = Object.entries(permission as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(
    ([resource, actions]) =>
      resource.length > 0 &&
      Array.isArray(actions) &&
      actions.length > 0 &&
      actions.every((a) => typeof a === "string" && a.length > 0)
  )
}

type Registry = Map<string, ExportDestination<unknown>>
const KEY = Symbol.for("fulvia.export.registry")

function registry(): Registry {
  const g = globalThis as unknown as Record<symbol, Registry | undefined>
  return (g[KEY] ??= new Map())
}

/** Registers (or, with the same id, replaces: hot reload) a destination. Throws on a bad id or permission. */
export function registerExport<Row>(destination: ExportDestination<Row>): void {
  if (!EXPORT_ID.test(destination.id))
    throw new Error(`registerExport: invalid id "${destination.id}"`)
  if (!isValidPermission(destination.permission))
    throw new Error(
      `registerExport("${destination.id}"): \`permission\` is required (at least one resource with one action)`
    )
  if (typeof destination.query !== "function")
    throw new Error(`registerExport("${destination.id}"): \`query\` must be a function`)
  registry().set(destination.id, destination as unknown as ExportDestination<unknown>)
}

export function findExport(id: string): ExportDestination<unknown> | undefined {
  return registry().get(id)
}

/** Only for tests. */
export function clearExports(): void {
  registry().clear()
}
