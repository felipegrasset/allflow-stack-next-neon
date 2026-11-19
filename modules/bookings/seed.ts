import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { es } from "./messages"

const TZ = "America/Santiago"

/** Weekday opening hours, minutes from local midnight. */
const weekdays = (ranges: [number, number][]) =>
  [1, 2, 3, 4, 5].flatMap((weekday) =>
    ranges.map(([start, end]) => ({ weekday, start, end }))
  )

/**
 * Three sample resources with their opening hours (Santiago time). No
 * bookings: they need real users. Idempotent: fixed ids, `on conflict do
 * nothing` (re-running never overwrites what an admin changed).
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const s = es.bookings.seed
  const resources = [
    {
      id: "seed-sala-pehuen",
      name: s.roomName,
      kind: "room" as const,
      details: s.roomDetails,
      slot_minutes: 60,
      hours: weekdays([[9 * 60, 13 * 60], [14 * 60, 19 * 60]]),
    },
    {
      id: "seed-camila-fuentes",
      name: s.professionalName,
      kind: "professional" as const,
      details: s.professionalDetails,
      slot_minutes: 45,
      hours: [
        ...weekdays([[10 * 60, 13 * 60], [15 * 60, 18 * 60]]),
        { weekday: 6, start: 10 * 60, end: 13 * 60 },
      ],
    },
    {
      id: "seed-corte-de-pelo",
      name: s.serviceName,
      kind: "service" as const,
      details: s.serviceDetails,
      slot_minutes: 30,
      hours: weekdays([[11 * 60, 20 * 60]]),
    },
  ]

  await db
    .insertInto("bookings_resources")
    .values(
      resources.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        details: r.details,
        timezone: TZ,
        slot_minutes: r.slot_minutes,
      }))
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()

  await db
    .insertInto("bookings_schedules")
    .values(
      resources.flatMap((r) =>
        r.hours.map((h) => ({
          id: `${r.id}-${h.weekday}-${h.start}`,
          resource_id: r.id,
          weekday: h.weekday,
          start_minute: h.start,
          end_minute: h.end,
        }))
      )
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()
}
