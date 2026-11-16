import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { FormAlert } from "@/components/form-alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { canCancel, isOrderId, shortOrderRef } from "../contracts/domain"
import { es } from "../messages"
import { canOrder, canSeeOrder, requirePagePermission } from "../server/guard"
import { reconcileOrder } from "../server/lifecycle"
import { defaultPorts } from "../server/ports"
import { mayAskProvider } from "../server/return"
import { getOrder, getOrderDetail } from "../server/store"
import { asLocale, formatMoney, one } from "./format"
import { OrderActions } from "./order-actions"
import { OrderLines } from "./order-lines"
import { StatusBadge } from "./status-badge"

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ pago?: string | string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, copy] = await Promise.all([params, getModuleCopy(es)])
  return { title: isOrderId(id) ? copy.detail.title(shortOrderRef(id)) : copy.list.title, robots: { index: false } }
}

/**
 * /orders/[id] — the buyer's own order, or any order with `order:manage`
 * (otherwise 404: an id says nothing about who owns it). It is also where the
 * provider's checkout returns (`?pago=1`): then, rate limited, it asks the
 * provider (`syncPayment`) before applying the payment. Every visit applies
 * what payments knows and expires the order if its time is up.
 */
export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const session = await requirePagePermission(`/orders/${encodeURIComponent(id)}`, "read")
  if (!isOrderId(id)) notFound()
  const db = getKysely()
  const canManage = await canOrder("manage")
  const viewer = { userId: session.user.id, canManage }
  const first = await getOrder(db, id)
  if (!first || !canSeeOrder(viewer, first)) notFound()

  const returning = one(sp.pago) === "1"
  try {
    const askProvider = returning && first.status === "pending" && (await mayAskProvider(id))
    await reconcileOrder(db, defaultPorts, id, { askProvider })
  } catch (e) {
    console.error("[orders] reconcile failed", id, e instanceof Error ? e.name : "error")
  }

  const [copy, locale, order, payment] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    getOrderDetail(db, id),
    defaultPorts.getPaymentByOrder(id).catch(() => null),
  ])
  if (!order) notFound()
  const ref = shortOrderRef(order.id)
  const isOwner = order.userId === session.user.id

  const notice =
    order.status === "paid" || order.status === "fulfilled"
      ? { ok: true, text: copy.detail.paidNotice }
      : order.status === "review"
        ? { ok: false, text: copy.detail.reviewNotice }
        : order.status === "expired"
          ? { ok: false, text: copy.detail.expiredNotice }
          : order.status === "canceled"
            ? { ok: false, text: copy.detail.canceledNotice }
            : returning
              ? { ok: true, text: copy.detail.returnPending }
              : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/orders" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {copy.detail.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{copy.detail.title(ref)}</h1>
          <StatusBadge status={order.status} label={copy.statuses[order.status]} />
        </div>
        <p className="text-sm text-muted-foreground">{copy.detail.created(formatDateTime(order.createdAt, locale))}</p>
        {order.status === "pending" ? (
          <p className="text-sm text-muted-foreground">{copy.detail.expires(formatDateTime(order.expiresAt, locale))}</p>
        ) : null}
        {order.paidAt ? (
          <p className="text-sm text-muted-foreground">{copy.detail.paidAt(formatDateTime(order.paidAt, locale))}</p>
        ) : null}
      </div>

      {notice ? <FormAlert variant={notice.ok ? "success" : "destructive"}>{notice.text}</FormAlert> : null}

      <section className="flex flex-col gap-3" aria-labelledby="order-items">
        <h2 id="order-items" className="text-base font-semibold">
          {copy.detail.items}
        </h2>
        <OrderLines
          lines={order.items.map((l) => ({ key: l.id, ...l }))}
          currency={order.currency}
          locale={locale}
          labels={{
            product: copy.cart.product,
            unitPrice: copy.detail.unitPrice,
            qty: copy.cart.qty,
            lineTotal: copy.cart.lineTotal,
            subtotal: copy.detail.subtotal,
            total: copy.detail.total,
            caption: copy.detail.items,
          }}
          subtotalMinor={order.subtotalMinor}
          discount={
            order.discountMinor > 0
              ? {
                  label: order.discountCode ? copy.detail.discount(order.discountCode) : copy.detail.discountNoCode,
                  amountMinor: order.discountMinor,
                }
              : null
          }
          totalMinor={order.totalMinor}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="order-payment">
        <h2 id="order-payment" className="text-base font-semibold">
          {copy.detail.payment}
        </h2>
        <p className="text-sm">
          {copy.detail.paymentStatus(copy.paymentStatuses[payment?.status ?? "none"])}
          {" · "}
          <span className="tabular-nums">{formatMoney(order.totalMinor, order.currency, locale)}</span>
        </p>
        <div aria-label={copy.detail.actionsLabel} role="group">
          <OrderActions
            orderId={order.id}
            canPay={isOwner && order.status === "pending"}
            canCancel={(isOwner || canManage) && canCancel(order.status, canManage)}
            canFulfill={canManage && order.status === "paid"}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="order-history">
        <h2 id="order-history" className="text-base font-semibold">
          {copy.detail.history}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.detail.historyDate}</TableHead>
              <TableHead>{copy.detail.historyFrom}</TableHead>
              <TableHead>{copy.detail.historyTo}</TableHead>
              <TableHead>{copy.detail.historyBy}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.history.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="text-muted-foreground">{formatDateTime(h.createdAt, locale)}</TableCell>
                <TableCell>{h.fromStatus ? copy.statuses[h.fromStatus] : copy.detail.historyCreated}</TableCell>
                <TableCell>{copy.statuses[h.toStatus]}</TableCell>
                <TableCell>{copy.actors[h.actorKind]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
