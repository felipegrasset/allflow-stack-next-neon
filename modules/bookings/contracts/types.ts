/** Types and errors of the bookings module. Pure: safe in server and client code. */

export const RESOURCE_KINDS = ["room", "professional", "service"] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export const BOOKING_STATUSES = ["confirmed", "cancelled"] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** Something that can be booked: a room, a professional or a service. */
export type Resource = {
  id: string
  name: string
  kind: ResourceKind
  details: string | null
  /** IANA zone of its opening hours (and of how its times are shown). */
  timezone: string
  /** Length of every booking of this resource, in minutes. */
  slotMinutes: number
  active: boolean
}

/** A weekly opening interval, wall clock in the resource's zone. */
export type OpeningInterval = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** Minutes from local midnight; `endMinute` is exclusive (1440 = midnight). */
  startMinute: number
  endMinute: number
}

export type Slot = { startsAt: Date; endsAt: Date }

export type Availability = {
  resource: Resource
  /** Same as `resource.timezone`: the zone `days[].date` is read in. */
  timezone: string
  /** One entry per requested day ("YYYY-MM-DD"), in order; `slots` is empty when closed or full. */
  days: { date: string; slots: Slot[] }[]
}

export type Booking = {
  id: string
  resourceId: string
  userId: string
  startsAt: Date
  endsAt: Date
  status: BookingStatus
  note: string | null
  cancelledAt: Date | null
  cancelledBy: string | null
  createdAt: Date
}

export type BookingWithDetails = Booking & {
  resourceName: string
  resourceKind: ResourceKind
  timezone: string
  userName: string
}

export const BOOKING_ERROR_CODES = [
  "resourceNotFound",
  "outsideSchedule",
  "inThePast",
  "slotTaken",
  "bookingNotFound",
  "forbidden",
  "alreadyStarted",
] as const
export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number]

/**
 * Every expected refusal of the module. `code` is also a key of
 * `bookings.errors` in messages.ts, so a screen shows `copy.errors[e.code]`.
 */
export class BookingError extends Error {
  readonly code: BookingErrorCode
  constructor(code: BookingErrorCode, message?: string) {
    super(message ?? code)
    this.name = "BookingError"
    this.code = code
  }
}

export function isBookingError(e: unknown): e is BookingError {
  return e instanceof BookingError
}
