import Link from "next/link"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { listBookings, listResources } from "../contracts"
import type { BookingWithDetails } from "../contracts/types"
import { es } from "../messages"
import { canBooking } from "../server/access"
import { cancelBookingAction } from "../server/actions"
import { formatDayHeading, formatTime, formatWhen, zoneLabel } from "../server/format"
import { currentLocale } from "../server/locale"
import { addDays, formatYmd, mondayOf, startOfDay, wallClock, type Ymd } from "../server/time"
import { EmptyState } from "./empty-state"
import { dateParam, one, query, type SearchParams } from "./params"

const FALLBACK_TZ = "UTC"

/**
 * /bookings — the agenda of a day or a week. With `booking: manage` it shows
 * everyone's bookings (filterable by resource); otherwise only one's own.
 */
export default async function BookingsAgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const session = await requireOnboardedUser("/bookings")
  const [copy, locale, resources, canManage, canCancel, canCreate] = await Promise.all([
    getModuleCopy(es),
    currentLocale(),
    listResources({ includeInactive: true }),
    canBooking("manage"),
    canBooking("cancel"),
    canBooking("create"),
  ])

  const resource = resources.find((r) => r.id === one(sp.resource))
  const tz = resource?.timezone ?? resources.find((r) => r.active)?.timezone ?? FALLBACK_TZ
  const view = one(sp.view) === "week" ? "week" : "day"
  const date = dateParam(one(sp.date), tz)
  const first = view === "week" ? mondayOf(date) : date
  const length = view === "week" ? 7 : 1
  const dates = Array.from({ length }, (_, i) => addDays(first, i))
  const from = startOfDay(first, tz)
  const to = startOfDay(addDays(first, length), tz)

  const bookings = await listBookings({
    from,
    to,
    userId: canManage ? undefined : session.user.id,
    resourceId: resource?.id,
  })
  const byDay = new Map<string, BookingWithDetails[]>()
  for (const b of bookings) {
    const w = wallClock(b.startsAt, tz)
    const key = formatYmd({ y: w.y, m: w.m, d: w.d })
    byDay.set(key, [...(byDay.get(key) ?? []), b])
  }

  const now = new Date()
  const link = (d: Ymd, v: string = view) =>
    `/bookings${query({ view: v, date: formatYmd(d), resource: resource?.id })}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.agenda.title}</h1>
          <p className="text-sm text-muted-foreground">
            {canManage ? copy.agenda.subtitleAll : copy.agenda.subtitleOwn}
          </p>
        </div>
        {canCreate ? <ButtonLink href="/bookings/new">{copy.agenda.newBooking}</ButtonLink> : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label={copy.agenda.viewLabel} className="flex flex-wrap items-center gap-2">
          <ButtonLink href={link(date, "day")} variant={view === "day" ? "secondary" : "ghost"} size="sm" aria-current={view === "day" ? "page" : undefined}>
            {copy.agenda.day}
          </ButtonLink>
          <ButtonLink href={link(date, "week")} variant={view === "week" ? "secondary" : "ghost"} size="sm" aria-current={view === "week" ? "page" : undefined}>
            {copy.agenda.week}
          </ButtonLink>
          <ButtonLink href={link(addDays(date, -length))} variant="outline" size="sm">
            {copy.agenda.previous}
          </ButtonLink>
          <ButtonLink href={`/bookings${query({ view, resource: resource?.id })}`} variant="outline" size="sm">
            {copy.agenda.today}
          </ButtonLink>
          <ButtonLink href={link(addDays(date, length))} variant="outline" size="sm">
            {copy.agenda.next}
          </ButtonLink>
        </nav>

        {resources.length > 1 ? (
          <form action="/bookings" method="get" className="flex items-end gap-2">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="date" value={formatYmd(date)} />
            <Field className="w-auto">
              <FieldLabel htmlFor="agenda-resource">{copy.agenda.resource}</FieldLabel>
              <NativeSelect id="agenda-resource" name="resource" defaultValue={resource?.id ?? ""} size="sm">
                <NativeSelectOption value="">{copy.agenda.allResources}</NativeSelectOption>
                {resources.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="outline" size="sm">
              {copy.agenda.apply}
            </Button>
          </form>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {copy.agenda.timezone(`${tz} · ${zoneLabel(from, locale, tz)}`)}
      </p>

      {bookings.length === 0 ? (
        <EmptyState
          title={copy.agenda.empty.title}
          description={copy.agenda.empty.description}
          action={
            canCreate ? (
              <Link href="/bookings/new" className="text-sm text-primary underline-offset-4 hover:underline">
                {copy.agenda.newBooking}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {dates.map((d) => {
            const key = formatYmd(d)
            const heading = formatDayHeading(startOfDay(d, tz), locale, tz)
            const items = byDay.get(key) ?? []
            return (
              <section key={key} className="flex flex-col gap-2" aria-label={copy.agenda.dayLabel(heading)}>
                <h2 className="text-sm font-medium capitalize">{heading}</h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.agenda.noBookingsDay}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {items.map((b) => {
                      const own = b.userId === session.user.id
                      const cancellable =
                        b.status === "confirmed" &&
                        (canManage || (canCancel && own && b.startsAt > now))
                      return (
                        <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium tabular-nums">
                                {formatTime(b.startsAt, locale, tz)}–{formatTime(b.endsAt, locale, tz)}
                              </span>
                              <span>{b.resourceName}</span>
                              <Badge variant="outline">{copy.kinds[b.resourceKind]}</Badge>
                            </div>
                            {canManage ? (
                              <span className="text-xs text-muted-foreground">
                                {copy.agenda.bookedBy(b.userName)}
                              </span>
                            ) : null}
                            {b.note ? <span className="text-xs text-muted-foreground">{b.note}</span> : null}
                          </div>
                          {cancellable ? (
                            <form action={cancelBookingAction}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                aria-label={copy.agenda.cancelLabel(formatWhen(b.startsAt, locale, tz))}
                              >
                                {copy.agenda.cancel}
                              </Button>
                            </form>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
