/**
 * Bookable slots: pure, so it is tested without a database. The slot grid is
 * each opening interval cut into `slotMinutes` pieces from its start; a slot is
 * offered when it starts at or after `notBefore` and does not overlap anything
 * in `busy` (touching ends do not overlap).
 */
import { formatYmd, wallClock, weekdayOf, zonedTimeToUtc, type Ymd } from "./time"

export type OpeningInterval = {
  weekday: number
  startMinute: number
  endMinute: number
}

export type Interval = { start: Date; end: Date }

export type DaySlots = { date: string; slots: Interval[] }

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/** The slot grid of one calendar day, before filtering. */
export function daySlots(
  date: Ymd,
  schedules: readonly OpeningInterval[],
  tz: string,
  slotMinutes: number
): Interval[] {
  if (!(slotMinutes > 0)) return []
  const weekday = weekdayOf(date)
  const seen = new Set<number>()
  const out: Interval[] = []
  const today = [...schedules]
    .filter((s) => s.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute)
  for (const s of today) {
    for (let m = s.startMinute; m + slotMinutes <= s.endMinute; m += slotMinutes) {
      const start = zonedTimeToUtc(date, m, tz)
      // A wall-clock time inside a DST gap does not exist: skip it rather than
      // offer an hour that silently moved.
      const w = wallClock(start, tz)
      if (w.y !== date.y || w.m !== date.m || w.d !== date.d || w.minute !== m) continue
      if (seen.has(start.getTime())) continue
      seen.add(start.getTime())
      out.push({ start, end: new Date(start.getTime() + slotMinutes * 60000) })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Free slots of each day in `dates`, in order. Days with none are kept (empty). */
export function computeSlots(opts: {
  dates: readonly Ymd[]
  schedules: readonly OpeningInterval[]
  tz: string
  slotMinutes: number
  busy: readonly Interval[]
  notBefore: Date
}): DaySlots[] {
  return opts.dates.map((date) => ({
    date: formatYmd(date),
    slots: daySlots(date, opts.schedules, opts.tz, opts.slotMinutes).filter(
      (slot) =>
        slot.start >= opts.notBefore && !opts.busy.some((b) => overlaps(slot, b))
    ),
  }))
}

/** Two intervals of the same weekday may not overlap (they would offer the same hour twice). */
export function schedulesOverlap(schedules: readonly OpeningInterval[]): boolean {
  const sorted = [...schedules].sort(
    (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute
  )
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1]
    const c = sorted[i]
    if (p.weekday === c.weekday && c.startMinute < p.endMinute) return true
  }
  return false
}
