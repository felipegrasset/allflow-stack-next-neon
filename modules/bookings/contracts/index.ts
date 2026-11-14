/**
 * The only thing another module (or the app) may import from `bookings`.
 * Server-only functions: do not call them from a client component.
 *
 *   import { getAvailability, createBooking, cancelBooking } from "@/modules/bookings/contracts"
 *
 *   const a = await getAvailability({ resourceId, from: "2026-11-16", days: 7 })
 *   const b = await createBooking({ resourceId, userId, startsAt: a.days[0].slots[0].startsAt })
 *   await cancelBooking({ bookingId: b.id, byUserId: userId })
 *
 * They do NOT check a session or a permission: the caller does (as the
 * module's own Server Actions do with `booking: create | cancel | manage`).
 * Expected refusals throw `BookingError` (`e.code` is a key of
 * `bookings.errors`); invalid input throws `ZodError`. Creating and cancelling
 * notify the booking's owner through `notify()` (a failed notice is logged,
 * never undoes the booking).
 */
import { getKysely } from "@/server/db/pool"

import * as core from "../server/core"
import { noticeBooking } from "../server/notices"

import type {
  AvailabilityInput,
  CancelBookingInput,
  CreateBookingInput,
  ResourceInput,
  WeeklyScheduleInput,
} from "./input"
import type { Booking } from "./types"

export const getAvailability = (input: AvailabilityInput) =>
  core.getAvailability(getKysely(), input)

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const db = getKysely()
  const booking = await core.createBooking(db, input)
  const details = await core.getBookingWithDetails(db, booking.id)
  if (details) await noticeBooking("created", details)
  return booking
}

export async function cancelBooking(
  input: CancelBookingInput
): Promise<{ booking: Booking; changed: boolean }> {
  const db = getKysely()
  const res = await core.cancelBooking(db, input)
  if (res.changed) {
    const details = await core.getBookingWithDetails(db, res.booking.id)
    if (details) await noticeBooking("cancelled", details)
  }
  return res
}

export const listResources = (opts?: { includeInactive?: boolean }) =>
  core.listResources(getKysely(), opts)
export const upsertResource = (input: ResourceInput) =>
  core.upsertResource(getKysely(), input)
export const setWeeklySchedule = (resourceId: string, intervals: WeeklyScheduleInput) =>
  core.setWeeklySchedule(getKysely(), resourceId, intervals)
export const listBookings = (opts: Parameters<typeof core.listBookings>[1]) =>
  core.listBookings(getKysely(), opts)

export {
  availabilityInputSchema,
  bookingSchemas,
  cancelBookingInputSchema,
  createBookingInputSchema,
  resourceInputSchema,
  weeklyScheduleSchema,
  type AvailabilityInput,
  type CancelBookingInput,
  type CreateBookingInput,
  type ResourceInput,
  type WeeklyScheduleInput,
} from "./input"
export * from "./types"
