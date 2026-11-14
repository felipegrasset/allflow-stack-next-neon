/**
 * The notices the module sends through notifications' `notify()`. A failed
 * notice never undoes a booking: it is logged and swallowed.
 */
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { notify } from "@/modules/notifications/contracts"

import type { BookingWithDetails } from "../contracts/types"
import { es } from "../messages"
import { formatWhen } from "./format"
import { currentLocale } from "./locale"
import { formatYmd, wallClock } from "./time"

type NoticeCopy = {
  createdTitle: string
  cancelledTitle: string
  createdBody: (resource: string, when: string) => string
  cancelledBody: (resource: string, when: string) => string
}

/** Outside a request there is no next-intl: fall back to the Spanish source. */
async function noticeCopy(): Promise<NoticeCopy> {
  try {
    const copy = await getModuleCopy(es)
    return {
      createdTitle: copy.notify.createdTitle,
      cancelledTitle: copy.notify.cancelledTitle,
      createdBody: (r, w) => copy.notify.createdBody(r, w),
      cancelledBody: (r, w) => copy.notify.cancelledBody(r, w),
    }
  } catch {
    const fill = (t: string, r: string, w: string) =>
      t.replace("{resource}", r).replace("{when}", w)
    const n = es.bookings.notify
    return {
      createdTitle: n.createdTitle,
      cancelledTitle: n.cancelledTitle,
      createdBody: (r, w) => fill(n.createdBody, r, w),
      cancelledBody: (r, w) => fill(n.cancelledBody, r, w),
    }
  }
}

function agendaHref(b: BookingWithDetails): string {
  const { y, m, d } = wallClock(b.startsAt, b.timezone)
  return `/bookings?date=${formatYmd({ y, m, d })}`
}

export async function noticeBooking(
  event: "created" | "cancelled",
  b: BookingWithDetails
): Promise<void> {
  try {
    const [copy, locale] = await Promise.all([noticeCopy(), currentLocale()])
    const when = formatWhen(b.startsAt, locale, b.timezone)
    await notify({
      id: `bookings-${event}-${b.id}`,
      userId: b.userId,
      kind: event === "created" ? "success" : "warning",
      title: event === "created" ? copy.createdTitle : copy.cancelledTitle,
      body:
        event === "created"
          ? copy.createdBody(b.resourceName, when)
          : copy.cancelledBody(b.resourceName, when),
      href: agendaHref(b),
    })
  } catch (e) {
    console.error("[bookings] notice failed", event, b.id, e)
  }
}
