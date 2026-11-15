/**
 * CSV parser. Pure and dependency-free. Handles quoted fields, escaped quotes
 * (`""`), line breaks inside a quoted field, a UTF-8 BOM, `,` `;` and tab as
 * delimiters, `\r\n` / `\n` / `\r` line ends, blank lines and rows of uneven
 * length (the parser returns them as they are; `plan.ts` decides).
 */
import { ImportError } from "./errors"

/** Size limit of the file. Server Actions accept 1 MB of body by default, so stay under it. */
export const MAX_CSV_BYTES = 800_000
/** Data rows (the header does not count). */
export const MAX_ROWS = 5_000
export const MAX_COLUMNS = 60

export const DELIMITERS = [",", ";", "\t"] as const
export type Delimiter = (typeof DELIMITERS)[number]

export type ParseOptions = {
  /** Fixed delimiter. Without it, it is detected from the first record. */
  delimiter?: Delimiter
  maxBytes?: number
  maxRows?: number
  maxColumns?: number
}

export type ParsedCsv = {
  delimiter: Delimiter
  headers: string[]
  rows: string[][]
}

export function isDelimiter(v: unknown): v is Delimiter {
  return typeof v === "string" && (DELIMITERS as readonly string[]).includes(v)
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** The delimiter that appears most in the first record (outside quotes). Ties and no candidate: comma. */
export function detectDelimiter(text: string): Delimiter {
  const count: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 }
  let inQuotes = false
  let atFieldStart = true
  const t = stripBom(text)
  for (let i = 0; i < t.length; i++) {
    const c = t.charAt(i)
    if (inQuotes) {
      if (c === '"') {
        if (t.charAt(i + 1) === '"') i++
        else inQuotes = false
      }
      continue
    }
    if (c === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
      continue
    }
    if (c === "\n" || c === "\r") break
    if (isDelimiter(c)) {
      count[c]++
      atFieldStart = true
      continue
    }
    atFieldStart = false
  }
  let best: Delimiter = ","
  for (const d of DELIMITERS) if (count[d] > count[best]) best = d
  return best
}

/**
 * Splits text into records. Blank lines are skipped. An unterminated quote
 * throws `unterminated_quote`; a row longer than `maxColumns` or more than
 * `maxRows` data rows throws too.
 */
export function parseRecords(
  text: string,
  delimiter: Delimiter,
  limits: { maxRows?: number; maxColumns?: number } = {}
): string[][] {
  const maxRows = limits.maxRows ?? MAX_ROWS
  const maxColumns = limits.maxColumns ?? MAX_COLUMNS
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let atFieldStart = true

  const endField = () => {
    row.push(field)
    field = ""
    atFieldStart = true
    if (row.length > maxColumns) throw new ImportError("too_many_columns")
  }
  const endRow = () => {
    endField()
    const blank = row.length === 1 && (row[0] ?? "").trim() === ""
    if (!blank) {
      rows.push(row)
      if (rows.length > maxRows + 1) throw new ImportError("too_many_rows")
    }
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i)
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
      continue
    }
    if (c === delimiter) {
      endField()
      continue
    }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i++
      endRow()
      continue
    }
    field += c
    atFieldStart = false
  }
  if (inQuotes) throw new ImportError("unterminated_quote")
  if (field !== "" || row.length > 0) endRow()
  return rows
}

/** Full parse: size check, BOM, delimiter, header row and data rows. */
export function parseCsv(text: string, opts: ParseOptions = {}): ParsedCsv {
  if (typeof text !== "string") throw new ImportError("empty")
  const maxBytes = opts.maxBytes ?? MAX_CSV_BYTES
  if (new TextEncoder().encode(text).length > maxBytes) throw new ImportError("too_large")
  const t = stripBom(text)
  if (t.trim() === "") throw new ImportError("empty")
  const delimiter = opts.delimiter ?? detectDelimiter(t)
  const records = parseRecords(t, delimiter, opts)
  const first = records[0]
  if (!first) throw new ImportError("empty")
  const rows = records.slice(1)
  if (rows.length === 0) throw new ImportError("no_rows")
  return { delimiter, headers: first.map((h) => h.trim()), rows }
}
