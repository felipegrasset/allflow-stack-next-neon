/**
 * Pure core of an import: header → field mapping, cell conversion and
 * validation, and the preview. No database, no request context.
 */
import { ImportError } from "./errors"
import { parseCsv, type Delimiter, type ParseOptions } from "./parse"
import type { ImportField, ImportRow, ImportTarget } from "./registry"

export const CELL_ERROR_CODES = [
  "required",
  "invalid_number",
  "invalid_integer",
  "invalid_boolean",
  "invalid_date",
  "invalid_email",
  "too_long",
  "invalid_value",
  "extra_cells",
] as const
export type CellErrorCode = (typeof CELL_ERROR_CODES)[number]

export function isCellErrorCode(v: unknown): v is CellErrorCode {
  return typeof v === "string" && (CELL_ERROR_CODES as readonly string[]).includes(v)
}

/** Field key → index of the CSV column (null: not loaded). */
export type Mapping = Record<string, number | null>

export type RowError = {
  /** Spreadsheet-style number: the header is row 1, the first data row is 2. */
  row: number
  /** Field key, or null for a problem of the whole row. */
  field: string | null
  code: CellErrorCode
}

export type PlanResult = {
  totalRows: number
  /** Rows without any error, with converted values. */
  valid: { row: number; values: ImportRow }[]
  /** First `MAX_REPORTED_ERRORS` errors. */
  errors: RowError[]
  /** Exact number of rows with at least one error. */
  errorRowCount: number
  /** First `SAMPLE_SIZE` rows as text, valid or not, for the preview table. */
  sample: { row: number; cells: Record<string, string> }[]
}

export const MAX_REPORTED_ERRORS = 200
export const SAMPLE_SIZE = 10

// ── header matching ───────────────────────────────────────────────────

/** "Correo Electrónico " → "correoelectronico". */
export function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function candidates(f: ImportField): string[] {
  const labels = typeof f.label === "string" ? [f.label] : [f.label.es, f.label.en]
  return [f.key, ...labels, ...(f.aliases ?? [])].map(normalizeHeader).filter((s) => s !== "")
}

/** Guesses which column feeds each field by header name. A column is used once. */
export function suggestMapping(target: ImportTarget, headers: readonly string[]): Mapping {
  const norm = headers.map(normalizeHeader)
  const used = new Set<number>()
  const out: Mapping = {}
  for (const f of target.fields) {
    const wanted = candidates(f)
    const idx = norm.findIndex((h, i) => !used.has(i) && h !== "" && wanted.includes(h))
    out[f.key] = idx === -1 ? null : idx
    if (idx !== -1) used.add(idx)
  }
  return out
}

/**
 * Cleans a mapping from the outside: only the target's fields, indexes inside
 * the file. Throws `invalid_mapping` for an unknown field or a bad index.
 */
export function normalizeMapping(target: ImportTarget, mapping: Mapping, columnCount: number): Mapping {
  const keys = new Set(target.fields.map((f) => f.key))
  for (const [k, v] of Object.entries(mapping)) {
    if (!keys.has(k)) throw new ImportError("invalid_mapping", `Unknown field "${k}"`)
    if (v !== null && (!Number.isInteger(v) || v < 0 || v >= columnCount))
      throw new ImportError("invalid_mapping", `Column of "${k}" is out of range`)
  }
  const out: Mapping = {}
  for (const f of target.fields) out[f.key] = mapping[f.key] ?? null
  return out
}

/** Required fields that have no column. */
export function missingRequired(target: ImportTarget, mapping: Mapping): string[] {
  return target.fields.filter((f) => f.required && (mapping[f.key] ?? null) === null).map((f) => f.key)
}

// ── cells ─────────────────────────────────────────────────────────────

/**
 * "1234.5", "1234,5", "1.234,5", "1,234.5" and "1 234" → number; otherwise null.
 * A single kind of separator followed by exactly three digits and preceded by
 * something other than a lone 0 is a thousands separator ("1.234" and "1,234"
 * are 1234); any other single separator is the decimal point.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[\s ]/g, "")
  if (!/^[+-]?(\d|[.,])+$/.test(s) || !/\d/.test(s)) return null
  const sign = s.startsWith("-") ? -1 : 1
  const body = s.replace(/^[+-]/, "")
  const dots = (body.match(/\./g) ?? []).length
  const commas = (body.match(/,/g) ?? []).length
  let normalized: string
  if (dots > 0 && commas > 0) {
    const dec = body.lastIndexOf(".") > body.lastIndexOf(",") ? "." : ","
    const thou = dec === "." ? "," : "."
    const at = body.lastIndexOf(dec)
    const intPart = body.slice(0, at)
    const frac = body.slice(at + 1)
    if (frac === "" || frac.includes(dec) || frac.includes(thou) || intPart.includes(dec)) return null
    const groups = intPart.split(thou)
    if (!/^\d{1,3}$/.test(groups[0] ?? "") || !groups.slice(1).every((g) => /^\d{3}$/.test(g))) return null
    normalized = `${groups.join("")}.${frac}`
  } else if (dots > 1 || commas > 1) {
    const sep = dots > 1 ? "." : ","
    const parts = body.split(sep)
    if (!parts.slice(1).every((p) => /^\d{3}$/.test(p)) || !/^\d{1,3}$/.test(parts[0] ?? "")) return null
    normalized = parts.join("")
  } else if (dots === 1 || commas === 1) {
    const sep = dots === 1 ? "." : ","
    const [int = "", frac = ""] = body.split(sep)
    if (frac === "") return null
    normalized = /^\d{3}$/.test(frac) && int !== "0" && int !== "" ? int + frac : `${int === "" ? "0" : int}.${frac}`
  } else {
    normalized = body
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? sign * n : null
}

const TRUE_WORDS = new Set(["true", "1", "si", "sí", "yes", "y", "verdadero", "x"])
const FALSE_WORDS = new Set(["false", "0", "no", "n", "falso"])

function parseDate(raw: string): string | null {
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (match) {
    y = Number(match[1])
    m = Number(match[2])
    d = Number(match[3])
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw) // day first, as in Chile
    if (!match) return null
    d = Number(match[1])
    m = Number(match[2])
    y = Number(match[3])
  }
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CellResult = { ok: true; value: unknown } | { ok: false; code: CellErrorCode }

/** Converts one raw cell by the field's type, then applies its `schema`. An empty cell is null (or `required`). */
export function coerceCell(field: ImportField, raw: string): CellResult {
  const text = raw.trim()
  if (text === "") return field.required ? { ok: false, code: "required" } : { ok: true, value: null }
  let value: unknown
  switch (field.type ?? "text") {
    case "text":
    case "email": {
      if (text.length > (field.maxLength ?? 500)) return { ok: false, code: "too_long" }
      if (field.type === "email" && !EMAIL_RE.test(text)) return { ok: false, code: "invalid_email" }
      value = text
      break
    }
    case "number": {
      const n = parseNumber(text)
      if (n === null) return { ok: false, code: "invalid_number" }
      value = n
      break
    }
    case "integer": {
      const n = parseNumber(text)
      if (n === null || !Number.isInteger(n)) return { ok: false, code: "invalid_integer" }
      value = n
      break
    }
    case "boolean": {
      const w = text.toLowerCase()
      if (TRUE_WORDS.has(w)) value = true
      else if (FALSE_WORDS.has(w)) value = false
      else return { ok: false, code: "invalid_boolean" }
      break
    }
    case "date": {
      const d = parseDate(text)
      if (d === null) return { ok: false, code: "invalid_date" }
      value = d
      break
    }
  }
  if (field.schema) {
    const r = field.schema.safeParse(value)
    if (!r.success) return { ok: false, code: "invalid_value" }
    value = r.data
  }
  return { ok: true, value }
}

// ── the plan ──────────────────────────────────────────────────────────

/**
 * Applies the mapping to every row. A row shorter than the header is padded
 * with empty cells; a longer one is an error (`extra_cells`) because the extra
 * data would be dropped silently.
 */
export function planImport(
  target: ImportTarget,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  mapping: Mapping
): PlanResult {
  const valid: PlanResult["valid"] = []
  const errors: RowError[] = []
  const sample: PlanResult["sample"] = []
  let errorRowCount = 0
  rows.forEach((cells, i) => {
    const row = i + 2
    const rowErrors: RowError[] = []
    if (cells.length > headers.length) rowErrors.push({ row, field: null, code: "extra_cells" })
    const values: ImportRow = {}
    const texts: Record<string, string> = {}
    for (const f of target.fields) {
      const col = mapping[f.key] ?? null
      const raw = col === null ? "" : (cells[col] ?? "")
      texts[f.key] = raw.trim()
      if (col === null && !f.required) {
        values[f.key] = null
        continue
      }
      const r = coerceCell(f, raw)
      if (r.ok) values[f.key] = r.value
      else rowErrors.push({ row, field: f.key, code: r.code })
    }
    if (sample.length < SAMPLE_SIZE) sample.push({ row, cells: texts })
    if (rowErrors.length === 0) valid.push({ row, values })
    else {
      errorRowCount++
      for (const e of rowErrors) if (errors.length < MAX_REPORTED_ERRORS) errors.push(e)
    }
  })
  return { totalRows: rows.length, valid, errors, errorRowCount, sample }
}

export type Prepared = {
  delimiter: Delimiter
  headers: string[]
  mapping: Mapping
  /** Required fields without a column; when not empty, `plan` is null. */
  missing: string[]
  plan: PlanResult | null
}

/** Text → everything the preview and the run need. Throws `ImportError` (file or mapping problems). */
export function prepareImport(
  target: ImportTarget,
  text: string,
  opts: ParseOptions & { mapping?: Mapping } = {}
): Prepared {
  const parsed = parseCsv(text, opts)
  const mapping = opts.mapping
    ? normalizeMapping(target, opts.mapping, parsed.headers.length)
    : suggestMapping(target, parsed.headers)
  const missing = missingRequired(target, mapping)
  const plan = missing.length === 0 ? planImport(target, parsed.headers, parsed.rows, mapping) : null
  return { delimiter: parsed.delimiter, headers: parsed.headers, mapping, missing, plan }
}

