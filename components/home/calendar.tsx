import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HomeEmptyState } from "./empty"
import type { HomeEmpty } from "./types"

export type CalendarEvent = {
  id: string
  title: string
  subtitle?: string
  /** ISO datetime. */
  start: string
  href?: string
}

const DAY = 86_400_000

/**
 * `calendar`: the week starting at `weekStart` (ISO date, the caller picks it
 * so this stays pure) plus an "upcoming" list. Seven columns on desktop, a
 * day-by-day list on mobile.
 */
export function CalendarHome({
  title,
  locale,
  weekStart,
  events,
  upcomingTitle,
  empty,
}: {
  title: string
  locale: string
  weekStart: string
  events: CalendarEvent[]
  upcomingTitle: string
  empty: HomeEmpty
}) {
  const t0 = Date.parse(`${weekStart.slice(0, 10)}T00:00:00Z`)
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" })
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = t0 + i * DAY
    return {
      label: dayFmt.format(from),
      items: sorted.filter((e) => Date.parse(e.start) >= from && Date.parse(e.start) < from + DAY),
    }
  })
  const upcoming = sorted.filter((e) => Date.parse(e.start) >= t0 + 7 * DAY).slice(0, 8)

  const item = (e: CalendarEvent) => {
    const body = (
      <>
        <span className="text-xs text-muted-foreground">{timeFmt.format(Date.parse(e.start))}</span>
        <span className="font-medium">{e.title}</span>
        {e.subtitle && <span className="text-xs text-muted-foreground">{e.subtitle}</span>}
      </>
    )
    return (
      <li key={e.id} className="flex flex-col rounded-lg bg-muted px-2 py-1.5 text-sm" data-testid="home-event">
        {e.href ? (
          <Link href={e.href} className="flex flex-col">
            {body}
          </Link>
        ) : (
          body
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {events.length === 0 ? (
        <HomeEmptyState {...empty} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {days.map((d) => (
              <Card key={d.label} size="sm" className={d.items.length === 0 ? "max-md:hidden" : undefined}>
                <CardHeader>
                  <CardTitle className="capitalize">{d.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1.5">{d.items.map(item)}</ul>
                </CardContent>
              </Card>
            ))}
          </div>
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-medium">{upcomingTitle}</h2>
              <ul className="flex flex-col gap-1.5">{upcoming.map(item)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
