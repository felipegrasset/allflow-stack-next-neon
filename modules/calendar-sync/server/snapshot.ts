/** From the bookings module's types to what calendar-sync needs. Pure. */
import type { BookingWithDetails } from "@/modules/bookings/contracts"

import type { BookingSnapshot } from "../contracts/types"

export function toSnapshot(b: Pick<BookingWithDetails, "id" | "userId" | "status" | "startsAt" | "endsAt" | "resourceName" | "timezone">): BookingSnapshot {
  return {
    id: b.id,
    userId: b.userId,
    status: b.status,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    resourceName: b.resourceName,
    timezone: b.timezone,
  }
}
