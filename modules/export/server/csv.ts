/**
 * CSV writing. Pure: no server or client APIs, so a handler, a Server Action
 * and a test can all use it.
 *
 * - RFC 4180: cells with the delimiter, a quote, CR, LF (or leading/trailing
 *   spaces) are quoted and inner quotes doubled; lines end in CRLF.
 * - Formula injection (CSV injection): a TEXT cell that starts with `=`, `+`,
 *   `-`, `@`, TAB or CR is prefixed with `'` so Excel / Sheets show it as
 *   text instead of running it. Real numbers (typeof number, bigint) are
 *   never touched, and neither are text cells that are a plain negative number
 *   (`-12.5`: numeric columns often arrive as strings, e.g. from Postgres).
 *   Headers get the same protection.
 * - BOM is optional: Excel opens UTF-8 as ANSI unless the file starts with it.
 */

export type CsvColumn<Row> =
  | { header: string; key: string; value?: undefined }
  | { header: string; value: (row: Row) => unknown; key?: undefined }

export type CsvOptions = {
  /** `,` (default) or `;` (Excel in es-CL / es-ES expects it). */
  delimiter?: "," | ";"
  /** Prepend a UTF-8 BOM so Excel reads accents correctly. Default false. */
  bom?: boolean
  /** Write the header row. Default true. */
  headers?: boolean
}

export const BOM = "﻿"
const NEWLINE = "\r\n"

const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NEGATIVE_NUMBER = /^-\d+([.,]\d+)?$/

/**
 * Prefixes `'` to text a spreadsheet could read as a formula. Leading spaces
 * are looked through (` =1+1`). A text that is just a negative number stays.
 */
export function neutralizeFormula(text: string): string {
  const probe = text.replace(/^[ \u00a0]+/, "")
  if (!FORMULA_START.test(probe)) return text
  if (PLAIN_NEGATIVE_NUMBER.test(probe)) return text
  return `'${text}`
}

/** Quotes a cell when it needs it. Expects the delimiter in use. */
export function escapeCell(text: string, delimiter: "," | ";" = ","): string {
  const needsQuotes =
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r") ||
    text !== text.trim()
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text
}

/** The text of one value, before escaping. Only real text gets formula protection. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return neutralizeFormula(value)
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

function valueOf<Row>(row: Row, col: CsvColumn<Row>): unknown {
  if (col.value) return col.value(row)
  return (row as Record<string, unknown> | null | undefined)?.[col.key as string]
}

/** Rows and columns to a CSV string (CRLF line endings, trailing newline). */
export function toCsv<Row>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
  options: CsvOptions = {}
): string {
  const delimiter = options.delimiter ?? ","
  if (delimiter !== "," && delimiter !== ";")
    throw new Error("toCsv: delimiter must be ',' or ';'")
  const lines: string[] = []
  if (options.headers !== false)
    lines.push(
      columns.map((c) => escapeCell(neutralizeFormula(c.header), delimiter)).join(delimiter)
    )
  for (const row of rows)
    lines.push(
      columns.map((c) => escapeCell(cellText(valueOf(row, c)), delimiter)).join(delimiter)
    )
  return (options.bom ? BOM : "") + lines.join(NEWLINE) + (lines.length ? NEWLINE : "")
}

/** A file name that is safe in a header: no path, quotes or control characters; ends in `.csv`. */
export function safeFileName(name: string | undefined, fallback = "export"): string {
  const cleaned = (name ?? "")
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.]+/, "")
    .slice(0, 100)
    .trim()
  const base = (cleaned || fallback).replace(/\.csv$/i, "") || fallback
  return `${base}.csv`
}

/** `Content-Disposition: attachment` with an ASCII fallback and the UTF-8 name (RFC 6266). */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/%/g, "_")
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}

/** The HTTP response for a CSV string (use `toCsv(..., { bom: true })` for Excel). */
export function csvResponse(
  csv: string,
  options: { filename?: string; status?: number } = {}
): Response {
  return new Response(csv, {
    status: options.status ?? 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": attachmentHeader(safeFileName(options.filename)),
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  })
}
