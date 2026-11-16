/**
 * The only thing another module (or the app) may import from calendar-sync.
 * Server-only.
 *
 * bookings has no "after create / after cancel" hook, so whoever creates or
 * cancels a booking calls `syncBookingToCalendar` afterwards, and a scheduled
 * job calls `reconcileCalendarSync` (which also catches the bookings nobody
 * reported):
 *
 *   import { after } from "next/server"
 *   import { createBooking } from "@/modules/bookings/contracts"
 *   import { syncBookingToCalendar } from "@/modules/calendar-sync/contracts"
 *
 *   const booking = await createBooking({ resourceId, userId, startsAt })
 *   after(() => syncBookingToCalendar(booking))      // never throws, never undoes the booking
 *
 *   // cron / jobs module, every 5–15 minutes:
 *   await reconcileCalendarSync()
 *
 * These functions do NOT check a session or a permission (like bookings'):
 * they only ever write to the calendar of the booking's owner, and only if
 * that person connected it.
 */
import { listResources, type Booking, type BookingWithDetails } from "@/modules/bookings/contracts"

import { reconcileDeps, store, syncDeps, log } from "../server/runtime"
import { reconcile, syncBooking } from "../server/sync"
import { toSnapshot } from "../server/snapshot"
import type { CalendarAccountView, ReconcileResult, SyncOutcome, SyncState } from "./types"

function hasDetails(b: Booking | BookingWithDetails): b is BookingWithDetails {
  return typeof (b as Partial<BookingWithDetails>).resourceName === "string" &&
    typeof (b as Partial<BookingWithDetails>).timezone === "string"
}

/**
 * Bring the booking's event in its owner's Google Calendar in line with the
 * booking: create or update it when `confirmed`, delete it when `cancelled`.
 * Idempotent (same booking → same event), best effort: NEVER throws and never
 * changes the booking. Pass what `createBooking` / `cancelBooking().booking`
 * returned, or a row of `listBookings`. On any failure the reconciliation
 * retries it.
 */
export async function syncBookingToCalendar(booking: Booking | BookingWithDetails): Promise<SyncOutcome> {
  try {
    let details: BookingWithDetails
    if (hasDetails(booking)) {
      details = booking
    } else {
      const resource = (await listResources({ includeInactive: true })).find((r) => r.id === booking.resourceId)
      if (!resource) {
        log("calendar-sync: resource not found", { booking: booking.id })
        return "failed"
      }
      details = {
        ...booking,
        resourceName: resource.name,
        resourceKind: resource.kind,
        timezone: resource.timezone,
        userName: "",
      }
    }
    return await syncBooking(syncDeps(), toSnapshot(details))
  } catch (err) {
    log("calendar-sync: sync error", { booking: booking.id, error: err instanceof Error ? err.name : "unknown" })
    return "retry"
  }
}

/**
 * The scheduled job (idempotent): retries due events, then compares each
 * connected account's bookings from 24 h ago to 60 days ahead with their
 * events, and deletes expired OAuth states. Throws only on a database error.
 */
export function reconcileCalendarSync(opts?: {
  userId?: string
  horizonDays?: number
  maxBookings?: number
}): Promise<ReconcileResult> {
  return reconcile(reconcileDeps(), opts)
}

/** The person's connection, without tokens; null if they never connected. */
export async function getCalendarAccount(userId: string): Promise<CalendarAccountView | null> {
  const a = await store().getAccount(userId)
  if (!a) return null
  return {
    userId: a.userId,
    status: a.status,
    disconnectReason: a.disconnectReason,
    calendarId: a.calendarId,
    connectedAt: a.connectedAt,
    updatedAt: a.updatedAt,
  }
}

/** How many of the person's bookings are in each sync state. */
export function countCalendarSync(userId: string): Promise<Record<SyncState, number>> {
  return store().countEvents(userId)
}

export * from "./types"
