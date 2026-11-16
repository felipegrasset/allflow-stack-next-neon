import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { FormAlert } from "@/components/form-alert"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getOrder, isOrderId, shortOrderRef } from "@/modules/orders/contracts"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { discountPagePath, orderPagePath } from "../server/paths"
import { DiscountCodeForm } from "./discount-code-form"
import { asLocale, formatMoney } from "./money"

type Params = Promise<{ id: string }>

/** Server-only clock read, outside the render body. */
function isPast(d: Date): boolean {
  return d.getTime() <= new Date().getTime()
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, copy] = await Promise.all([params, getModuleCopy(es)])
  return { title: copy.page.title(isOrderId(id) ? shortOrderRef(id) : ""), robots: { index: false } }
}

/**
 * /orders/[id]/descuento — the buyer types a code on THEIR pending order
 * before paying. Anyone else gets 404 (an id says nothing about who owns it).
 * Shows the stored subtotal, discount and total (read from orders, never
 * from the browser), and links back to the order page, where "Pay" charges
 * the stored total.
 */
export default async function OrderDiscountPage({ params }: { params: Params }) {
  const { id } = await params
  const session = await requireOnboardedUser(discountPagePath(encodeURIComponent(id)))
  if (!isOrderId(id)) notFound()
  const order = await getOrder(id)
  if (!order || order.userId !== session.user.id) notFound()
  const [copy, locale] = await Promise.all([getModuleCopy(es), getLocale().then(asLocale)])
  const p = copy.page
  const money = (n: number) => formatMoney(n, order.currency, locale)
  const expired = order.status === "pending" && isPast(order.expiresAt)
  const open = order.status === "pending" && !expired

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{p.title(shortOrderRef(order.id))}</h1>
        <p className="text-sm text-muted-foreground">{p.intro}</p>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl border border-border p-4 text-sm">
        <dt className="text-muted-foreground">{p.subtotal}</dt>
        <dd className="text-right tabular-nums">{money(order.subtotalMinor)}</dd>
        <dt className="text-muted-foreground">{p.discount}</dt>
        <dd className="text-right tabular-nums">{order.discountMinor > 0 ? `−${money(order.discountMinor)}` : money(0)}</dd>
        <dt className="font-medium">{p.total}</dt>
        <dd className="text-right font-medium tabular-nums">{money(order.totalMinor)}</dd>
      </dl>

      {open ? (
        <DiscountCodeForm orderId={order.id} appliedCode={order.discountCode} />
      ) : (
        <FormAlert>{expired ? p.expired : p.closed}</FormAlert>
      )}

      <Link href={orderPagePath(order.id)} className="text-sm text-primary underline-offset-4 hover:underline">
        {p.back}
      </Link>
    </div>
  )
}
