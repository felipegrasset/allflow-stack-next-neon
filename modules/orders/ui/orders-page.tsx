import Link from "next/link"
import type { Metadata } from "next"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { shortOrderRef } from "../contracts/domain"
import { es } from "../messages"
import { canOrder, requirePagePermission } from "../server/guard"
import { listOrdersForUser } from "../server/store"
import { asLocale, formatMoney } from "./format"
import { StatusBadge } from "./status-badge"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.list.title }
}

/** /orders — the person's OWN orders (`order:read`). Staff sees everyone's in /admin/orders. */
export default async function OrdersPage() {
  const session = await requirePagePermission("/orders", "read")
  const [copy, locale, orders, canManage] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    listOrdersForUser(getKysely(), session.user.id),
    canOrder("manage"),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.list.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.list.subtitle}</p>
        </div>
        {canManage ? (
          <ButtonLink href="/admin/orders" variant="outline" size="sm">
            {copy.list.adminLink}
          </ButtonLink>
        ) : null}
      </div>
      <section className="flex flex-col gap-3" aria-label={copy.list.listLabel}>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {copy.list.count(orders.length)}
        </p>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">{copy.list.empty}</p>
            <ButtonLink href="/productos" variant="outline" size="sm">
              {copy.cart.browse}
            </ButtonLink>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.list.ref}</TableHead>
                <TableHead className="hidden sm:table-cell">{copy.list.date}</TableHead>
                <TableHead>{copy.list.status}</TableHead>
                <TableHead className="text-right">{copy.list.total}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link href={`/orders/${o.id}`} className="font-mono underline-offset-2 hover:underline">
                      {shortOrderRef(o.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDateTime(o.createdAt, locale)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} label={copy.statuses[o.status]} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(o.totalMinor, o.currency, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
