import { forbidden } from "next/navigation"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { listResources } from "../contracts"
import { es } from "../messages"
import { canBooking } from "../server/access"
import { BookingPanel } from "./booking-panel"
import { EmptyState } from "./empty-state"
import { dateParam, formatYmd, one, query, type SearchParams } from "./params"
import { Picker } from "./picker"

/** /bookings/new — pick a resource and a day, then a free time. Needs `booking: create`. */
export default async function NewBookingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  await requireOnboardedUser(`/bookings/new${query({ resource: one(sp.resource), date: one(sp.date) })}`)
  if (!(await canBooking("create"))) forbidden()

  const [copy, resources] = await Promise.all([getModuleCopy(es), listResources()])
  const resource = resources.find((r) => r.id === one(sp.resource)) ?? resources[0]
  const date = resource ? formatYmd(dateParam(one(sp.date), resource.timezone)) : ""

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.newPage.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.newPage.subtitle}</p>
      </div>
      {!resource ? (
        <EmptyState
          title={copy.picker.noResources.title}
          description={copy.picker.noResources.description}
        />
      ) : (
        <>
          <Picker action="/bookings/new" resources={resources} resourceId={resource.id} date={date} />
          <BookingPanel
            resourceId={resource.id}
            date={date}
            canBook
            successHref={`/bookings${query({ date })}`}
          />
        </>
      )}
    </div>
  )
}
