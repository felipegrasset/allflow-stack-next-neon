/**
 * bookings against real Postgres: the double-booking guarantee under
 * concurrency, availability, and cancel/rebook. Creates its own schema (with a
 * minimal "user" table) and drops it at the end.
 *
 * Skipped without DATABASE_URL — and says so.
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { BookingError } from "../contracts/types"
import { up } from "../db/migrations/0103_bookings_init"
import {
  cancelBooking,
  createBooking,
  getAvailability,
  listBookings,
  setWeeklySchedule,
  upsertResource,
} from "../server/core"
import { addDays, formatYmd, todayIn, zonedTimeToUtc } from "../server/time"

const url = process.env.DATABASE_URL
const skip = url ? false : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `bookings_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const TZ = "America/Santiago"

let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 10 })
  // public stays in the path: btree_gist's operator classes may live there.
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}, public`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await pool.query(`create table "user" (id text primary key, name text not null)`)
  await pool.query(`insert into "user" (id, name) values ('ana', 'Ana Rojas'), ('beto', 'Beto Muñoz')`)
  await up(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

/** A resource open every day 09:00–12:00, 60' slots; returns it and tomorrow's 10:00. */
async function fixture() {
  const r = await upsertResource(db, { name: "Sala de prueba", timezone: TZ, slotMinutes: 60 })
  await setWeeklySchedule(db, r.id, [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 720 })))
  const tomorrow = addDays(todayIn(TZ), 1)
  return { r, tomorrow, ten: zonedTimeToUtc(tomorrow, 600, TZ) }
}

test("availability: 3 slots tomorrow, one fewer after booking it", { skip }, async () => {
  const { r, tomorrow, ten } = await fixture()
  const before = await getAvailability(db, { resourceId: r.id, from: formatYmd(tomorrow) })
  assert.equal(before.days[0].slots.length, 3)
  await createBooking(db, { resourceId: r.id, userId: "ana", startsAt: ten })
  const afterBooking = await getAvailability(db, { resourceId: r.id, from: formatYmd(tomorrow) })
  assert.equal(afterBooking.days[0].slots.length, 2)
  assert.ok(!afterBooking.days[0].slots.some((s) => s.startsAt.getTime() === ten.getTime()))
})

test("concurrency: 8 simultaneous bookings of the same slot, exactly one wins", { skip }, async () => {
  const { r, ten } = await fixture()
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) =>
      createBooking(db, { resourceId: r.id, userId: i % 2 ? "ana" : "beto", startsAt: ten })
    )
  )
  const ok = results.filter((x) => x.status === "fulfilled")
  const taken = results.filter(
    (x) => x.status === "rejected" && x.reason instanceof BookingError && x.reason.code === "slotTaken"
  )
  assert.equal(ok.length, 1)
  assert.equal(taken.length, 7)
})

test("the exclusion constraint holds even if the code is bypassed", { skip }, async () => {
  const { r, ten } = await fixture()
  await createBooking(db, { resourceId: r.id, userId: "ana", startsAt: ten })
  await assert.rejects(
    db
      .insertInto("bookings_bookings")
      .values({
        id: "raw-overlap",
        resource_id: r.id,
        user_id: "beto",
        starts_at: new Date(ten.getTime() + 30 * 60000),
        ends_at: new Date(ten.getTime() + 90 * 60000),
      })
      .execute(),
    (e: { code?: string }) => e.code === "23P01"
  )
})

test("refusals: outside the hours, off-grid, in the past, unknown resource", { skip }, async () => {
  const { r, tomorrow } = await fixture()
  const code = (p: Promise<unknown>, c: string) =>
    assert.rejects(p, (e) => e instanceof BookingError && e.code === c)
  await code(createBooking(db, { resourceId: r.id, userId: "ana", startsAt: zonedTimeToUtc(tomorrow, 13 * 60, TZ) }), "outsideSchedule")
  await code(createBooking(db, { resourceId: r.id, userId: "ana", startsAt: zonedTimeToUtc(tomorrow, 9 * 60 + 15, TZ) }), "outsideSchedule")
  await code(createBooking(db, { resourceId: r.id, userId: "ana", startsAt: new Date(Date.now() - 864e5) }), "inThePast")
  await code(createBooking(db, { resourceId: "nope", userId: "ana", startsAt: zonedTimeToUtc(tomorrow, 600, TZ) }), "resourceNotFound")
})

test("cancel: only the owner (or a manager); idempotent; the slot is free again", { skip }, async () => {
  const { r, ten } = await fixture()
  const b = await createBooking(db, { resourceId: r.id, userId: "ana", startsAt: ten })
  await assert.rejects(
    cancelBooking(db, { bookingId: b.id, byUserId: "beto" }),
    (e) => e instanceof BookingError && e.code === "forbidden"
  )
  const first = await cancelBooking(db, { bookingId: b.id, byUserId: "ana" })
  assert.equal(first.changed, true)
  assert.equal(first.booking.status, "cancelled")
  const again = await cancelBooking(db, { bookingId: b.id, byUserId: "ana" })
  assert.equal(again.changed, false)
  const rebooked = await createBooking(db, { resourceId: r.id, userId: "beto", startsAt: ten })
  assert.equal(rebooked.status, "confirmed")
  const listed = await listBookings(db, { from: ten, to: new Date(ten.getTime() + 3600000), resourceId: r.id })
  assert.deepEqual(listed.map((x) => x.userName), ["Beto Muñoz"])
})

test("cancel: an owner cannot cancel once started; a manager can", { skip }, async () => {
  const { r, ten } = await fixture()
  const b = await createBooking(db, { resourceId: r.id, userId: "ana", startsAt: ten })
  const later = new Date(ten.getTime() + 10 * 60000)
  await assert.rejects(
    cancelBooking(db, { bookingId: b.id, byUserId: "ana" }, later),
    (e) => e instanceof BookingError && e.code === "alreadyStarted"
  )
  const res = await cancelBooking(db, { bookingId: b.id, byUserId: "beto", asManager: true }, later)
  assert.equal(res.booking.cancelledBy, "beto")
})
