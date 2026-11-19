import Link from "next/link"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { listMine } from "../server/queries"
import { asLocale } from "./format"
import { StatusBadge } from "./status-badge"
import { TicketForm } from "./ticket-form"

/** /tickets — the person's own tickets and, with `ticket:create`, the new-ticket form. */
export default async function TicketsPage() {
  const session = await requirePagePermission("/tickets", "read")
  const [copy, tickets, canCreate, canManage, locale] = await Promise.all([
    getModuleCopy(es),
    listMine(session.user.id),
    can("create"),
    can("manage"),
    getLocale().then(asLocale),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.list.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.list.subtitle}</p>
        </div>
        {canManage ? (
          <ButtonLink href="/admin/tickets" variant="outline" size="sm">
            {copy.list.adminLink}
          </ButtonLink>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col gap-3" aria-label={copy.list.listLabel}>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {copy.list.count(tickets.length)}
          </p>
          {tickets.length === 0 ? (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">{copy.list.empty}</p>
              {canCreate ? <p className="text-sm text-muted-foreground">{copy.list.emptyHint}</p> : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.list.columns.subject}</TableHead>
                  <TableHead>{copy.list.columns.status}</TableHead>
                  <TableHead className="hidden sm:table-cell">{copy.list.columns.updated}</TableHead>
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
                    <TableCell>
                      <StatusBadge status={t.status} label={copy.statuses[t.status]} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDateTime(t.updatedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {canCreate ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-labelledby="tickets-new">
            <h2 id="tickets-new" className="text-base font-semibold">
              {copy.list.newTitle}
            </h2>
            <TicketForm />
          </section>
        ) : null}
      </div>
    </div>
  )
}
