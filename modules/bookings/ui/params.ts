/** Reading the query string of the module's pages. Pure. */
import { formatYmd, parseYmd, todayIn, type Ymd } from "../server/time"

export type SearchParams = Promise<Record<string, string | string[] | undefined>>

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/** `?date=` if it is a real date, else today in `tz`. */
export function dateParam(raw: string | undefined, tz: string, now = new Date()): Ymd {
  return (raw && parseYmd(raw)) || todayIn(tz, now)
}

export function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ""
}

export { formatYmd }
