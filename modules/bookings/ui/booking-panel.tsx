import { ButtonLink } from "@/components/button-link"
import { FormAlert } from "@/components/form-alert"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { getAvailability } from "../contracts"
import { isBookingError } from "../contracts/types"
import { es } from "../messages"
import { formatTime, zoneLabel } from "../server/format"
import { currentLocale } from "../server/locale"
import { BookingForm } from "./booking-form"
import { EmptyState } from "./empty-state"

/**
 * Free slots of one resource on one day and, when `canBook`, the form to book
 * one. `signInHref` replaces the form for a visitor with no session.
 */
export async function BookingPanel({
  resourceId,
  date,
  canBook,
  signInHref,
  forbidden,
  successHref,
}: {
  resourceId: string
  date: string
  canBook: boolean
  signInHref?: string
  forbidden?: boolean
  successHref: string
}) {
  const [copy, locale] = await Promise.all([getModuleCopy(es), currentLocale()])
  let availability
  try {
    availability = await getAvailability({ resourceId, from: date, days: 1 })
  } catch (e) {
    if (isBookingError(e)) return <FormAlert>{copy.errors[e.code]}</FormAlert>
    throw e
  }
  const tz = availability.timezone
  const slots = availability.days[0]?.slots ?? []
  if (slots.length === 0)
    return (
      <EmptyState
        title={copy.picker.closed.title}
        description={copy.picker.closed.description}
      />
    )

  const options = slots.map((s) => ({
    value: s.startsAt.toISOString(),
    label: formatTime(s.startsAt, locale, tz),
  }))
  const zone = zoneLabel(slots[0].startsAt, locale, tz)

  if (canBook)
    return (
      <BookingForm
        key={`${resourceId}-${date}`}
        resourceId={resourceId}
        slots={options}
        zone={zone}
        slotMinutes={availability.resource.slotMinutes}
        successHref={successHref}
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {copy.form.slotsHelp(zone, availability.resource.slotMinutes)}
      </p>
      <ul aria-label={copy.form.slots} className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
        {options.map((o) => (
          <li
            key={o.value}
            className="rounded-lg border border-border px-3 py-2 text-center text-sm tabular-nums"
          >
            {o.label}
          </li>
        ))}
      </ul>
      {forbidden ? (
        <FormAlert>{copy.publicPage.forbidden}</FormAlert>
      ) : signInHref ? (
        <ButtonLink href={signInHref} className="self-start">
          {copy.publicPage.signIn}
        </ButtonLink>
      ) : null}
    </div>
  )
}
