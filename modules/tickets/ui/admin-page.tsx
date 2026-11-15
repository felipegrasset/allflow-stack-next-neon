import Link from "next/link"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { TICKET_STATUSES, isTicketStatus } from "../contracts/domain"
import { es } from "../messages"
import { requirePagePermission } from "../server/guard"
import { listAll } from "../server/queries"
import { asLocale } from "./format"
import { StatusBadge } from "./status-badge"

/** /admin/tickets — every ticket, filterable by status (GET ?status=). Needs `ticket:manage`. */
export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  await requirePagePermission("/admin/tickets", "manage")
  const raw = (await searchParams).status
  const value = Array.isArray(raw) ? raw[0] : raw
  const status = isTicketStatus(value) ? value : undefined
  const [copy, tickets, locale] = await Promise.all([
    getModuleCopy(es),
    listAll(status),
    getLocale().then(asLocale),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.admin.subtitle}</p>
        </div>
        <ButtonLink href="/tickets" variant="outline" size="sm">
          {copy.admin.back}
        </ButtonLink>
      </div>

      <form role="search" method="get" className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="tickets-filter" className="text-sm font-medium">
            {copy.admin.filterLabel}
          </label>
          <NativeSelect id="tickets-filter" name="status" defaultValue={status ?? ""}>
            <NativeSelectOption value="">{copy.admin.all}</NativeSelectOption>
            {TICKET_STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {copy.statuses[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          {copy.admin.apply}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {copy.list.count(tickets.length)}
      </p>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {copy.admin.empty}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.list.columns.subject}</TableHead>
              <TableHead className="hidden md:table-cell">{copy.admin.requester}</TableHead>
              <TableHead>{copy.list.columns.status}</TableHead>
              <TableHead className="hidden sm:table-cell">{copy.list.columns.priority}</TableHead>
              <TableHead className="hidden lg:table-cell">{copy.list.columns.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <Link href={`/tickets/${t.id}`} className="underline-offset-2 hover:underline">
                    {t.subject}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {t.requesterName ?? copy.detail.unknownUser}
                </TableCell>
                <TableCell>
                  <StatusBadge status={t.status} label={copy.statuses[t.status]} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {copy.priorities[t.priority]}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDateTime(t.updatedAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
