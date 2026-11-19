import Link from "next/link"
import type { Metadata } from "next"
import { getLocale } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { shortOrderRef } from "../contracts/domain"
import { orderStatusSchema } from "../contracts/input"
import { ORDER_STATUSES } from "../contracts/types"
import { es } from "../messages"
import { requirePagePermission } from "../server/guard"
import { listAllOrders } from "../server/store"
import { asLocale, formatMoney, one } from "./format"
import { StatusBadge } from "./status-badge"

type SearchParams = Promise<{ estado?: string | string[] }>

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.admin.title }
}

/** /admin/orders — every order (`order:manage`), newest first, filterable by status (`?estado=`). */
export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("/admin/orders", "manage")
  const sp = await searchParams
  const parsed = orderStatusSchema.safeParse(one(sp.estado))
  const status = parsed.success ? parsed.data : undefined
  const [copy, locale, orders] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    listAllOrders(getKysely(), { status }),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.admin.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.admin.subtitle}</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="orders-status" className="text-sm font-medium">
            {copy.admin.filter}
          </label>
          <NativeSelect id="orders-status" name="estado" defaultValue={status ?? ""}>
            <option value="">{copy.admin.all}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {copy.statuses[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          {copy.admin.apply}
        </Button>
      </form>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm">{copy.admin.empty}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.list.ref}</TableHead>
                <TableHead>{copy.admin.buyer}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.list.date}</TableHead>
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
                  <TableCell>
                    {o.buyerName ?? copy.admin.unknownBuyer}
                    {o.buyerEmail ? <span className="block text-xs text-muted-foreground">{o.buyerEmail}</span> : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
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
          <p className="text-xs text-muted-foreground">{copy.admin.limitNote}</p>
        </>
      )}
    </div>
  )
}
