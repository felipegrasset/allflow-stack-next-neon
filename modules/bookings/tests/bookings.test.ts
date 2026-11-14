/**
 * bookings v0.1 — what runs without a database: time zone arithmetic, the
 * slot grid, the schemas, the catalog and (by reading the code) the guards.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { bookingSchemas } from "../contracts/input"
import { BOOKING_ERROR_CODES } from "../contracts/types"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { computeSlots, daySlots, schedulesOverlap } from "../server/slots"
import {
  addDays,
  formatYmd,
  mondayOf,
  parseYmd,
  startOfDay,
  wallClock,
  zonedTimeToUtc,
} from "../server/time"

const SCL = "America/Santiago"
const NY = "America/New_York"

test("parseYmd: only real calendar dates", () => {
  assert.deepEqual(parseYmd("2026-11-16"), { y: 2026, m: 11, d: 16 })
  for (const bad of ["2026-02-30", "2026-13-01", "16-11-2026", "2026-1-5", ""])
    assert.equal(parseYmd(bad), null, bad)
  assert.equal(formatYmd(addDays({ y: 2026, m: 12, d: 31 }, 1)), "2027-01-01")
  assert.equal(formatYmd(mondayOf({ y: 2026, m: 11, d: 15 })), "2026-11-09") // Sunday
  assert.equal(formatYmd(mondayOf({ y: 2026, m: 11, d: 16 })), "2026-11-16") // Monday
})

test("zonedTimeToUtc: wall clock in the zone, offset by date (no fixed offset)", () => {
  // New York: EST (-5) in January, EDT (-4) in July.
  assert.equal(zonedTimeToUtc({ y: 2026, m: 1, d: 15 }, 9 * 60, NY).toISOString(), "2026-01-15T14:00:00.000Z")
  assert.equal(zonedTimeToUtc({ y: 2026, m: 7, d: 15 }, 9 * 60, NY).toISOString(), "2026-07-15T13:00:00.000Z")
  const back = wallClock(new Date("2026-07-15T13:00:00Z"), NY)
  assert.deepEqual([back.y, back.m, back.d, back.minute, back.weekday], [2026, 7, 15, 540, 3])
  // Santiago round-trips whatever its current rule is.
  const t = zonedTimeToUtc({ y: 2026, m: 11, d: 16 }, 10 * 60, SCL)
  const w = wallClock(t, SCL)
  assert.deepEqual([w.d, w.minute], [16, 600])
  assert.equal(startOfDay({ y: 2026, m: 1, d: 15 }, NY).toISOString(), "2026-01-15T05:00:00.000Z")
})

const weekday = (wd: number, start: number, end: number) => ({
  weekday: wd,
  startMinute: start,
  endMinute: end,
})

test("daySlots: cuts each interval by the slot length; the remainder is not offered", () => {
  // 2026-11-16 is a Monday (1). 09:00–10:40 with 30' slots → 09:00, 09:30, 10:00.
  const slots = daySlots({ y: 2026, m: 11, d: 16 }, [weekday(1, 540, 640)], NY, 30)
  assert.equal(slots.length, 3)
  assert.equal(slots[0].start.toISOString(), "2026-11-16T14:00:00.000Z")
  assert.equal(slots[2].end.getTime() - slots[2].start.getTime(), 30 * 60000)
  assert.equal(daySlots({ y: 2026, m: 11, d: 17 }, [weekday(1, 540, 640)], NY, 30).length, 0)
})

test("daySlots: a wall-clock time inside a DST gap is skipped, not moved", () => {
  // New York, Sunday 2026-03-08: 02:00 does not exist.
  const slots = daySlots({ y: 2026, m: 3, d: 8 }, [weekday(0, 60, 240)], NY, 60)
  const hours = slots.map((s) => wallClock(s.start, NY).minute / 60)
  assert.deepEqual(hours, [1, 3])
})

test("computeSlots: drops past slots and anything overlapping a booking (touching is fine)", () => {
  const date = { y: 2026, m: 11, d: 16 }
  const at = (h: number) => zonedTimeToUtc(date, h * 60, NY)
  const days = computeSlots({
    dates: [date, addDays(date, 1)],
    schedules: [weekday(1, 9 * 60, 13 * 60)],
    tz: NY,
    slotMinutes: 60,
    busy: [{ start: at(11), end: at(12) }],
    notBefore: at(10),
  })
  assert.equal(days.length, 2)
  assert.equal(days[0].date, "2026-11-16")
  assert.deepEqual(
    days[0].slots.map((s) => wallClock(s.start, NY).minute / 60),
    [10, 12]
  )
  assert.deepEqual(days[1].slots, [])
})

test("schedulesOverlap: same weekday overlapping intervals only", () => {
  assert.equal(schedulesOverlap([weekday(1, 540, 780), weekday(1, 840, 1080)]), false)
  assert.equal(schedulesOverlap([weekday(1, 540, 780), weekday(2, 600, 700)]), false)
  assert.equal(schedulesOverlap([weekday(1, 540, 780), weekday(1, 700, 900)]), true)
})

test("schemas: validate input and refuse what the database would", () => {
  const s = bookingSchemas()
  assert.equal(s.availabilityInput.parse({ resourceId: "r", from: "2026-11-16" }).days, 1)
  assert.equal(s.availabilityInput.safeParse({ resourceId: "r", from: "2026-02-30" }).success, false)
  assert.equal(s.availabilityInput.safeParse({ resourceId: "r", from: "2026-11-16", days: 32 }).success, false)

  const ok = s.createBookingInput.parse({ resourceId: "r", userId: "u", startsAt: "2026-11-16T14:00:00Z", note: "  " })
  assert.ok(ok.startsAt instanceof Date)
  assert.equal(ok.note, undefined)
  assert.equal(s.createBookingInput.safeParse({ resourceId: "r", userId: "u", startsAt: "mañana" }).success, false)
  assert.equal(s.createBookingInput.safeParse({ resourceId: "r", userId: "", startsAt: "2026-11-16T14:00:00Z" }).success, false)

  assert.equal(s.cancelBookingInput.parse({ bookingId: "b", byUserId: "u" }).asManager, false)

  assert.equal(s.resourceInput.safeParse({ name: "Sala", timezone: "America/Santiago" }).success, true)
  assert.equal(s.resourceInput.safeParse({ name: "Sala", timezone: "Marte/Olympus" }).success, false)
  assert.equal(s.resourceInput.safeParse({ name: "Sala", timezone: "UTC", slotMinutes: 2 }).success, false)

  assert.equal(s.weeklySchedule.safeParse([weekday(1, 540, 780)]).success, true)
  assert.equal(s.weeklySchedule.safeParse([weekday(1, 780, 540)]).success, false)
  assert.equal(s.weeklySchedule.safeParse([weekday(7, 540, 780)]).success, false)
  assert.equal(s.weeklySchedule.safeParse([weekday(1, 540, 780), weekday(1, 600, 900)]).success, false)

  // Messages come from the copy passed in.
  const english = bookingSchemas(en.bookings.validation)
  const r = english.bookingForm.safeParse({ resourceId: "r", startsAt: "", note: "" })
  assert.equal(r.success, false)
  assert.equal(r.error?.issues[0].message, en.bookings.validation.slot)
})

/** Every leaf path of a catalog, with its ICU argument names. */
function leaves(tree: object, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === "string") {
      const args = [...v.matchAll(/\{\s*(\w+)/g)].map((m) => m[1]).sort().join(",")
      out.set(p, args)
    } else for (const [kk, vv] of leaves(v as object, p)) out.set(kk, vv)
  }
  return out
}

test("messages: es and en have the same keys and arguments, none empty; every error code has a text", () => {
  const a = leaves(es)
  const b = leaves(en)
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort())
  for (const [k, args] of a) assert.equal(b.get(k), args, k)
  for (const tree of [es, en])
    for (const k of leaves(tree).keys()) {
      const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], tree)
      assert.ok(typeof v === "string" && v.trim().length > 0, k)
    }
  for (const code of BOOKING_ERROR_CODES) assert.ok(code in es.bookings.errors, code)
})

test("permissions: create/cancel/manage; member books and cancels, never manages", () => {
  assert.deepEqual(permissions.statement, { booking: ["create", "cancel", "manage"] })
  assert.deepEqual(permissions.grants.member, { booking: ["create", "cancel"] })
})

// ── Access and the guarantee, read from the code ────────────────────────────

const MOD = join(process.cwd(), "modules", "bookings")
const src = (f: string) => readFileSync(join(MOD, f), "utf8")

test("actions: each one checks the session, then the permission, before touching data", () => {
  const bodies = src("server/actions.ts").split(/export async function /).slice(1)
  assert.equal(bodies.length, 2)
  for (const body of bodies) {
    const name = body.slice(0, body.indexOf("("))
    const guard = body.indexOf("requireOnboardedUser(")
    const perm = body.indexOf("canBooking(")
    assert.ok(guard > 0, `${name}: no session guard`)
    assert.ok(perm > guard, `${name}: no permission check after the guard`)
    for (const call of ["createBooking(", "cancelBooking("]) {
      const at = body.indexOf(call)
      if (at >= 0) assert.ok(perm < at, `${name}: ${call} before the permission check`)
    }
    assert.match(body, /session\.user\.id/, `${name}: the user must come from the session`)
  }
})

test("pages: the app pages call their guard; the public one never books by itself", () => {
  assert.match(src("ui/page.tsx"), /requireOnboardedUser\("\/bookings"\)/)
  assert.match(src("ui/new-page.tsx"), /requireOnboardedUser\(/)
  assert.match(src("ui/new-page.tsx"), /canBooking\("create"\)/)
  assert.doesNotMatch(src("ui/public-page.tsx"), /createBooking\(/)
})

test("no double booking is enforced by the database", () => {
  const m = src("db/migrations/0103_bookings_init.ts")
  assert.match(m, /exclude using gist/)
  assert.match(m, /tstzrange\(starts_at, ends_at, '\[\)'\) with &&/)
  assert.match(m, /where \(status = 'confirmed'\)/)
  const core = src("server/core.ts")
  assert.match(core, /\.forUpdate\(\)/)
  assert.match(core, /23P01/)
})
