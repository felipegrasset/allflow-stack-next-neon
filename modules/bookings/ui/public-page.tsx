import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getSession } from "@/server/session"

import { listResources } from "../contracts"
import { es } from "../messages"
import { canBooking } from "../server/access"
import { BookingPanel } from "./booking-panel"
import { EmptyState } from "./empty-state"
import { dateParam, formatYmd, one, query, type SearchParams } from "./params"
import { Picker } from "./picker"

/**
 * /reservar — public. Anyone sees the free times; booking needs a session and
 * `booking: create` (the visitor gets a sign-in link that comes back here).
 * It shows only free times, never who booked.
 */
export default async function PublicBookingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const [copy, resources, session] = await Promise.all([
    getModuleCopy(es),
    listResources(),
    getSession(),
  ])
  const resource = resources.find((r) => r.id === one(sp.resource)) ?? resources[0]
  const date = resource ? formatYmd(dateParam(one(sp.date), resource.timezone)) : ""
  const canBook = session ? await canBooking("create") : false
  const back = `/reservar${query({ resource: resource?.id, date })}`

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy.publicPage.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.publicPage.subtitle}</p>
      </div>
      {!resource ? (
        <EmptyState
          title={copy.picker.noResources.title}
          description={copy.picker.noResources.description}
        />
      ) : (
        <>
          <Picker action="/reservar" resources={resources} resourceId={resource.id} date={date} />
          <BookingPanel
            resourceId={resource.id}
            date={date}
            canBook={canBook}
            forbidden={!!session && !canBook}
            signInHref={session ? undefined : `/login${query({ next: back })}`}
            successHref={`/bookings${query({ date })}`}
          />
        </>
      )}
    </main>
  )
}
