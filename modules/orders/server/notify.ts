/**
 * Notices when an order is paid, through `notifications` (contracts only).
 * Best effort: a failed notice never undoes a payment; it is logged (order id
 * and error name only) and dropped. Idempotent by id: reconciling the same
 * order twice creates one notice per person.
 */
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { notify, notifyPermission } from "@/modules/notifications/contracts"

import { shortOrderRef } from "../contracts/domain"
import type { Order } from "../contracts/types"
import { es } from "../messages"

const MAX_RECIPIENTS = 50

/** Texts in the locale of the request; outside a request (cron), the Spanish source. */
async function texts(ref: string): Promise<{ staff: string; buyer: string }> {
  try {
    const copy = await getModuleCopy(es)
    return { staff: copy.notify.paidStaff(ref), buyer: copy.notify.paidBuyer(ref) }
  } catch {
    return {
      staff: es.orders.notify.paidStaff.replace("{ref}", ref),
      buyer: es.orders.notify.paidBuyer.replace("{ref}", ref),
    }
  }
}

export async function notifyPaid(order: Order): Promise<void> {
  try {
    const t = await texts(shortOrderRef(order.id))
    const href = `/orders/${order.id}`
    const results = await Promise.allSettled([
      notifyPermission(
        { resource: "order", action: "manage" },
        { title: t.staff.slice(0, 120), href, kind: "success", id: `orders-paid-${order.id}` },
        { excludeUserIds: [order.userId], limit: MAX_RECIPIENTS }
      ),
      notify({ userId: order.userId, title: t.buyer.slice(0, 120), href, kind: "success", id: `orders-paid-${order.id}-buyer` }),
    ])
    for (const r of results)
      if (r.status === "rejected")
        console.error("[orders] notify failed", order.id, r.reason instanceof Error ? r.reason.name : "error")
  } catch (e) {
    console.error("[orders] notify failed", order.id, e instanceof Error ? e.name : "error")
  }
}
