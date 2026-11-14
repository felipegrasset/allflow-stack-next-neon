/**
 * Time zone arithmetic with Intl only (no date library). Pure: no imports, so
 * the tests run it as is. Opening hours are wall-clock times in a resource's
 * IANA zone; bookings are UTC instants. Everything converts through here so a
 * DST change never shifts a slot by an hour.
 *
 * Adapted from allflow.biz src/lib/whatsapp/availability.ts.
 */

/** A calendar date, "YYYY-MM-DD", with no zone attached. */
export type Ymd = { y: number; m: number; d: number }

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Parses "YYYY-MM-DD" into a real calendar date, or null (rejects 2026-02-30). */
export function parseYmd(value: string): Ymd | null {
  const m = YMD.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d)
    return null
  return { y, m: mo, d }
}

export function formatYmd({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function addDays(date: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Day of week of a calendar date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: Ymd): number {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay()
}

/** Monday of the week that contains `date`. */
export function mondayOf(date: Ymd): Ymd {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

/** What the wall clock reads in `tz` at `instant`. */
export function wallClock(
  instant: Date,
  tz: string
): Ymd & { minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const hour = get("hour") === 24 ? 0 : get("hour")
  const date = { y: get("year"), m: get("month"), d: get("day") }
  return { ...date, minute: hour * 60 + get("minute"), weekday: weekdayOf(date) }
}

/** UTC offset of `tz` at `instant`, in minutes (Santiago in winter: -240). */
export function offsetMinutes(instant: Date, tz: string): number {
  const w = wallClock(instant, tz)
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, 0, w.minute, instant.getUTCSeconds())
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/**
 * The UTC instant at which the wall clock in `tz` reads `date` + `minute`
 * (minutes from local midnight). Two passes: the offset depends on the instant
 * and a first guess can land on the wrong side of a DST change. A wall-clock
 * time that does not exist (inside a DST gap) comes back shifted: callers that
 * care compare with `wallClock` (see slots.ts).
 */
export function zonedTimeToUtc(date: Ymd, minute: number, tz: string): Date {
  const naive = Date.UTC(date.y, date.m - 1, date.d, 0, minute)
  let guess = new Date(naive - offsetMinutes(new Date(naive), tz) * 60000)
  guess = new Date(naive - offsetMinutes(guess, tz) * 60000)
  return guess
}

/** The instant the calendar day `date` starts in `tz`. */
export function startOfDay(date: Ymd, tz: string): Date {
  return zonedTimeToUtc(date, 0, tz)
}

/** Today's calendar date in `tz`. */
export function todayIn(tz: string, now: Date = new Date()): Ymd {
  const { y, m, d } = wallClock(now, tz)
  return { y, m, d }
}
