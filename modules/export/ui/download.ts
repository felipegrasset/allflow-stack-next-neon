/** Pure helpers of the export button (kept apart so they can be tested without React). */

export const EXPORT_CLIENT_ERRORS = [
  "unauthorized",
  "forbidden",
  "not_found",
  "too_many_rows",
  "failed",
  "network",
] as const
export type ExportClientError = (typeof EXPORT_CLIENT_ERRORS)[number]

export const isExportError = (v: unknown): v is ExportClientError =>
  typeof v === "string" && (EXPORT_CLIENT_ERRORS as readonly string[]).includes(v)

/** `/api/export/<id>?a=1&b=2`; empty and undefined params are left out. */
export function exportUrl(id: string, params?: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") qs.set(k, v)
  const s = qs.toString()
  return `/api/export/${encodeURIComponent(id)}${s ? `?${s}` : ""}`
}

/** The file name the server suggested, or `fallback`. Prefers `filename*=UTF-8''…`. */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      // fall through to the plain name
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header)
  return plain?.[1]?.trim() || fallback
}
