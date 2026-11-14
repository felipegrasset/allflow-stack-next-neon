/**
 * Date and time labels for bookings, always in the resource's zone and always
 * with the zone spelled out ("16:00 (GMT-3)"): a bare hour read from another
 * zone gets missed. Uses i18n's INTL_TAG so every locale formats like the app.
 */
import { INTL_TAG, type Locale } from "@/modules/i18n/contracts"

export function formatTime(d: Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d)
}

/** "lunes, 16 de noviembre" — the heading of a day in the agenda. */
export function formatDayHeading(d: Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(d)
}

/** "GMT-3" for a zone at an instant. */
export function zoneLabel(d: Date, locale: Locale, timeZone: string): string {
  return (
    new Intl.DateTimeFormat(INTL_TAG[locale], {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? timeZone
  )
}

/** "16 nov 2026, 16:00 (GMT-3)". */
export function formatWhen(d: Date, locale: Locale, timeZone: string): string {
  const date = new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(d)
  return `${date} (${zoneLabel(d, locale, timeZone)})`
}
