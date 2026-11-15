/**
 * Import targets: the allow-list of places a CSV may be loaded into. A target
 * is declared with `registerImportTarget` by another module or by the app;
 * the CSV can never point at an arbitrary table. Pure (types only).
 */
import type { Kysely } from "kysely"
import type { z } from "zod"

import type { Database } from "@/server/db/schema"

import { ImportError } from "./errors"

export type Localized = string | { es: string; en: string }

export type FieldType = "text" | "email" | "integer" | "number" | "boolean" | "date"

export type ImportField = {
  /** Key of the value in the row `insert` receives. */
  key: string
  label: Localized
  /** Default `text`. `date` yields "YYYY-MM-DD"; `number`/`integer` a JS number; `boolean` a boolean. */
  type?: FieldType
  required?: boolean
  /** Extra header names that map to this field automatically. */
  aliases?: readonly string[]
  /** Text and email only. Default 500. */
  maxLength?: number
  /** Extra rule on the already converted value. An empty optional cell skips it (value is null). */
  schema?: z.ZodType<unknown>
}

export type ImportRow = Record<string, unknown>

export type ImportContext = {
  /** The transaction of the whole run: write ONLY through it. */
  db: Kysely<Database>
  userId: string | null
}

export type ImportTarget = {
  id: string
  label: Localized
  description?: Localized
  fields: readonly ImportField[]
  /**
   * Writes one batch (at most `IMPORT_BATCH_SIZE` rows of validated values).
   * Runs inside a single transaction for the whole file: if any batch throws,
   * nothing is saved. Must be idempotent-safe against being retried by the user.
   */
  insert: (rows: ImportRow[], ctx: ImportContext) => Promise<void>
}

export const IMPORT_BATCH_SIZE = 200

const ID_RE = /^[a-z][a-z0-9_-]{0,62}$/
const FIELD_RE = /^[a-z][A-Za-z0-9_]{0,62}$/

export function localize(value: Localized, locale: string): string {
  if (typeof value === "string") return value
  return locale === "en" ? value.en : value.es
}

// On globalThis so duplicated bundles of this file (Next compiles pages and
// actions separately) share one map within a process.
const REGISTRY_KEY = Symbol.for("fulvia.csv-import.targets")
type G = typeof globalThis & { [REGISTRY_KEY]?: Map<string, ImportTarget> }
function registry(): Map<string, ImportTarget> {
  const g = globalThis as G
  return (g[REGISTRY_KEY] ??= new Map())
}

/**
 * Declares an import target and registers it in this process. Throws
 * `ImportError("invalid_target")` for a bad id, no fields, a repeated or badly
 * written field key. Registering the same id again replaces it (hot reload).
 */
export function registerImportTarget(target: ImportTarget): ImportTarget {
  if (!ID_RE.test(target.id)) throw new ImportError("invalid_target", `Invalid target id "${target.id}"`)
  if (target.fields.length === 0) throw new ImportError("invalid_target", `Target "${target.id}" has no fields`)
  if (typeof target.insert !== "function") throw new ImportError("invalid_target", `Target "${target.id}" has no insert`)
  const seen = new Set<string>()
  for (const f of target.fields) {
    if (!FIELD_RE.test(f.key) || seen.has(f.key))
      throw new ImportError("invalid_target", `Target "${target.id}": bad or repeated field "${f.key}"`)
    seen.add(f.key)
  }
  const frozen: ImportTarget = Object.freeze({ ...target, fields: Object.freeze([...target.fields]) })
  registry().set(frozen.id, frozen)
  return frozen
}

export function findImportTarget(id: string): ImportTarget | undefined {
  return registry().get(id)
}

export function listImportTargets(): ImportTarget[] {
  return [...registry().values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Test helper. */
export function clearImportTargets(): void {
  registry().clear()
}
