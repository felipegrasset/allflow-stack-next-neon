/**
 * The bookings logic over an explicit Kysely (`db`), so the Postgres tests run
 * it against their own schema. `contracts/` wraps it with the app's pool and
 * the notifications; nothing here checks a session: callers do (actions.ts).
 */
import type { Kysely, Selectable, Transaction } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  bookingSchemas,
  type AvailabilityInput,
  type CancelBookingInput,
  type CreateBookingInput,
  type ResourceInput,
  type WeeklyScheduleInput,
} from "../contracts/input"
import {
  BookingError,
  type Availability,
  type Booking,
  type BookingWithDetails,
  type OpeningInterval,
  type Resource,
} from "../contracts/types"
import type {
  BookingsBookingsTable,
  BookingsResourcesTable,
} from "../db/types"
import { computeSlots, daySlots, overlaps } from "./slots"
import { addDays, parseYmd, startOfDay, wallClock } from "./time"

type Db = Kysely<Database>
type Tx = Kysely<Database> | Transaction<Database>

const schemas = bookingSchemas()

/** Postgres: exclusion_violation (bookings_bookings_no_overlap). */
const EXCLUSION_VIOLATION = "23P01"

export function toResource(r: Selectable<BookingsResourcesTable>): Resource {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    details: r.details,
    timezone: r.timezone,
    slotMinutes: r.slot_minutes,
    active: r.active,
  }
}

export function toBooking(r: Selectable<BookingsBookingsTable>): Booking {
  return {
    id: r.id,
    resourceId: r.resource_id,
    userId: r.user_id,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    status: r.status,
    note: r.note,
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : null,
    cancelledBy: r.cancelled_by,
    createdAt: new Date(r.created_at),
  }
}

// ── Resources and opening hours ──────────────────────────────────────────────

export async function listResources(
  db: Db,
  opts: { includeInactive?: boolean } = {}
): Promise<Resource[]> {
  let q = db.selectFrom("bookings_resources").selectAll().orderBy("name")
  if (!opts.includeInactive) q = q.where("active", "=", true)
  return (await q.execute()).map(toResource)
}

export async function getResource(db: Tx, id: string): Promise<Resource | null> {
  const row = await db
    .selectFrom("bookings_resources")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()
  return row ? toResource(row) : null
}

export async function getSchedule(db: Tx, resourceId: string): Promise<OpeningInterval[]> {
  const rows = await db
    .selectFrom("bookings_schedules")
    .select(["weekday", "start_minute", "end_minute"])
    .where("resource_id", "=", resourceId)
    .orderBy("weekday")
    .orderBy("start_minute")
    .execute()
  return rows.map((r) => ({
    weekday: r.weekday,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
  }))
}

/** Creates or updates a resource (by `id`). Throws `ZodError` on invalid input. */
export async function upsertResource(db: Db, input: ResourceInput): Promise<Resource> {
  const v = schemas.resourceInput.parse(input)
  const values = {
    id: v.id ?? crypto.randomUUID(),
    name: v.name,
    kind: v.kind,
    details: v.details || null,
    timezone: v.timezone,
    slot_minutes: v.slotMinutes,
    active: v.active,
  }
  const row = await db
    .insertInto("bookings_resources")
    .values(values)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        name: values.name,
        kind: values.kind,
        details: values.details,
        timezone: values.timezone,
        slot_minutes: values.slot_minutes,
        active: values.active,
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow()
  return toResource(row)
}

/**
 * Replaces the whole weekly schedule of a resource, in one transaction.
 * Existing bookings are kept even if they now fall outside the hours.
 */
export async function setWeeklySchedule(
  db: Db,
  resourceId: string,
  intervals: WeeklyScheduleInput
): Promise<OpeningInterval[]> {
  const list = schemas.weeklySchedule.parse(intervals)
  return db.transaction().execute(async (trx) => {
    const resource = await getResource(trx, resourceId)
    if (!resource) throw new BookingError("resourceNotFound")
    await trx.deleteFrom("bookings_schedules").where("resource_id", "=", resourceId).execute()
    if (list.length > 0)
      await trx
        .insertInto("bookings_schedules")
        .values(
          list.map((s) => ({
            id: crypto.randomUUID(),
            resource_id: resourceId,
            weekday: s.weekday,
            start_minute: s.startMinute,
            end_minute: s.endMinute,
          }))
        )
        .execute()
    return getSchedule(trx, resourceId)
  })
}

// ── Availability ─────────────────────────────────────────────────────────────

async function confirmedBetween(db: Tx, resourceId: string, from: Date, to: Date) {
  const rows = await db
    .selectFrom("bookings_bookings")
    .select(["starts_at", "ends_at"])
    .where("resource_id", "=", resourceId)
    .where("status", "=", "confirmed")
    .where("starts_at", "<", to)
    .where("ends_at", ">", from)
    .execute()
  return rows.map((r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) }))
}

/**
 * Free slots of an active resource for `days` days from `from` (a date in the
 * resource's zone). Slots that already started (`now`) are not offered.
 * Throws `BookingError("resourceNotFound")` or `ZodError`.
 */
export async function getAvailability(
  db: Db,
  input: AvailabilityInput,
  now: Date = new Date()
): Promise<Availability> {
  const v = schemas.availabilityInput.parse(input)
  const resource = await getResource(db, v.resourceId)
  if (!resource || !resource.active) throw new BookingError("resourceNotFound")
  const tz = resource.timezone
  const first = parseYmd(v.from)!
  const dates = Array.from({ length: v.days }, (_, i) => addDays(first, i))
  const windowStart = startOfDay(first, tz)
  const windowEnd = startOfDay(addDays(first, v.days), tz)
  const [schedule, busy] = await Promise.all([
    getSchedule(db, resource.id),
    confirmedBetween(db, resource.id, windowStart, windowEnd),
  ])
  const days = computeSlots({
    dates,
    schedules: schedule,
    tz,
    slotMinutes: resource.slotMinutes,
    busy,
    notBefore: now,
  })
  return {
    resource,
    timezone: tz,
    days: days.map((d) => ({
      date: d.date,
      slots: d.slots.map((s) => ({ startsAt: s.start, endsAt: s.end })),
    })),
  }
}

// ── Book and cancel ──────────────────────────────────────────────────────────

function isExclusionViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === EXCLUSION_VIOLATION
  )
}

/**
 * Books `startsAt` (which must be exactly a slot of the resource's grid).
 *
 * The guarantee against a double booking is the database: the resource row is
 * locked (`for update`, so two bookings of the same resource run one after the
 * other), the overlap is checked inside that lock, and the exclusion
 * constraint `bookings_bookings_no_overlap` rejects whatever slips past it.
 * Throws `BookingError` (`resourceNotFound`, `outsideSchedule`, `inThePast`,
 * `slotTaken`) or `ZodError`.
 */
export async function createBooking(
  db: Db,
  input: CreateBookingInput,
  now: Date = new Date()
): Promise<Booking> {
  const v = schemas.createBookingInput.parse(input)
  try {
    return await db.transaction().execute(async (trx) => {
      const locked = await trx
        .selectFrom("bookings_resources")
        .selectAll()
        .where("id", "=", v.resourceId)
        .where("active", "=", true)
        .forUpdate()
        .executeTakeFirst()
      if (!locked) throw new BookingError("resourceNotFound")
      const resource = toResource(locked)

      if (v.startsAt < now) throw new BookingError("inThePast")
      const local = wallClock(v.startsAt, resource.timezone)
      const grid = daySlots(
        { y: local.y, m: local.m, d: local.d },
        await getSchedule(trx, resource.id),
        resource.timezone,
        resource.slotMinutes
      )
      const slot = grid.find((s) => s.start.getTime() === v.startsAt.getTime())
      if (!slot) throw new BookingError("outsideSchedule")

      const busy = await confirmedBetween(trx, resource.id, slot.start, slot.end)
      if (busy.some((b) => overlaps(slot, b))) throw new BookingError("slotTaken")

      const row = await trx
        .insertInto("bookings_bookings")
        .values({
          id: crypto.randomUUID(),
          resource_id: resource.id,
          user_id: v.userId,
          starts_at: slot.start,
          ends_at: slot.end,
          note: v.note ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return toBooking(row)
    })
  } catch (e) {
    if (isExclusionViolation(e)) throw new BookingError("slotTaken")
    throw e
  }
}

/**
 * Cancels a confirmed booking. Its owner may cancel it until it starts; with
 * `asManager` (the caller checked `booking: manage`) anyone's, any time.
 * Cancelling an already cancelled booking returns it unchanged (`changed:
 * false`). Throws `BookingError` (`bookingNotFound`, `forbidden`,
 * `alreadyStarted`) or `ZodError`.
 */
export async function cancelBooking(
  db: Db,
  input: CancelBookingInput,
  now: Date = new Date()
): Promise<{ booking: Booking; changed: boolean }> {
  const v = schemas.cancelBookingInput.parse(input)
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("bookings_bookings")
      .selectAll()
      .where("id", "=", v.bookingId)
      .forUpdate()
      .executeTakeFirst()
    if (!row) throw new BookingError("bookingNotFound")
    const booking = toBooking(row)
    if (!v.asManager && booking.userId !== v.byUserId) throw new BookingError("forbidden")
    if (booking.status === "cancelled") return { booking, changed: false }
    if (!v.asManager && booking.startsAt <= now) throw new BookingError("alreadyStarted")
    const updated = await trx
      .updateTable("bookings_bookings")
      .set({ status: "cancelled", cancelled_at: now, cancelled_by: v.byUserId })
      .where("id", "=", booking.id)
      .where("status", "=", "confirmed")
      .returningAll()
      .executeTakeFirstOrThrow()
    return { booking: toBooking(updated), changed: true }
  })
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** Bookings that overlap [from, to), soonest first. `userId` limits to one person's. */
export async function listBookings(
  db: Db,
  opts: {
    from: Date
    to: Date
    userId?: string
    resourceId?: string
    includeCancelled?: boolean
  }
): Promise<BookingWithDetails[]> {
  let q = db
    .selectFrom("bookings_bookings as b")
    .innerJoin("bookings_resources as r", "r.id", "b.resource_id")
    .innerJoin("user as u", "u.id", "b.user_id")
    .selectAll("b")
    .select([
      "r.name as resource_name",
      "r.kind as resource_kind",
      "r.timezone as resource_timezone",
      "u.name as user_name",
    ])
    .where("b.starts_at", "<", opts.to)
    .where("b.ends_at", ">", opts.from)
    .orderBy("b.starts_at")
    .limit(500)
  if (opts.userId) q = q.where("b.user_id", "=", opts.userId)
  if (opts.resourceId) q = q.where("b.resource_id", "=", opts.resourceId)
  if (!opts.includeCancelled) q = q.where("b.status", "=", "confirmed")
  const rows = await q.execute()
  return rows.map((r) => ({
    ...toBooking(r),
    resourceName: r.resource_name,
    resourceKind: r.resource_kind,
    timezone: r.resource_timezone,
    userName: r.user_name,
  }))
}

export async function getBookingWithDetails(
  db: Db,
  bookingId: string
): Promise<BookingWithDetails | null> {
  const r = await db
    .selectFrom("bookings_bookings as b")
    .innerJoin("bookings_resources as r", "r.id", "b.resource_id")
    .innerJoin("user as u", "u.id", "b.user_id")
    .selectAll("b")
    .select([
      "r.name as resource_name",
      "r.kind as resource_kind",
      "r.timezone as resource_timezone",
      "u.name as user_name",
    ])
    .where("b.id", "=", bookingId)
    .executeTakeFirst()
  if (!r) return null
  return {
    ...toBooking(r),
    resourceName: r.resource_name,
    resourceKind: r.resource_kind,
    timezone: r.resource_timezone,
    userName: r.user_name,
  }
}
