import Link from "next/link"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { listContacts } from "../server/queries"
import { ContactForm } from "./contact-form"
import { asLocale } from "./format"
import { StatusBadge } from "./status-badge"

/** /crm/contacts — list with search (GET ?q=) and, with `contact:write`, the new-contact form. */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requirePagePermission("/crm/contacts", ["contact", "read"])
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? ""
  const [copy, contacts, canWrite, canDeals, locale] = await Promise.all([
    getModuleCopy(es),
    listContacts(q),
    can("contact", "write"),
    can("deal", "read"),
    getLocale().then(asLocale),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.contacts.title}</h1>
          <p className="text-sm text-muted-foreground">
            {copy.contacts.subtitle}
          </p>
        </div>
        {canDeals ? (
          <ButtonLink href="/crm" variant="outline" size="sm">
            {copy.contacts.pipelineLink}
          </ButtonLink>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-3" aria-label={copy.contacts.listLabel}>
          <form role="search" method="get" className="flex gap-2">
            <label htmlFor="crm-contacts-q" className="sr-only">
              {copy.contacts.searchLabel}
            </label>
            <Input
              id="crm-contacts-q"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={100}
              placeholder={copy.contacts.searchPlaceholder}
            />
            <Button type="submit" variant="outline">
              {copy.contacts.searchSubmit}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {copy.contacts.count(contacts.length)}
          </p>
          {contacts.length === 0 ? (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">
                {q ? copy.contacts.emptySearch(q) : copy.contacts.empty}
              </p>
              {!q && canWrite ? (
                <p className="text-sm text-muted-foreground">
                  {copy.contacts.emptyHint}
                </p>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.contacts.columns.name}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {copy.contacts.columns.company}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {copy.contacts.columns.email}
                  </TableHead>
                  <TableHead>{copy.contacts.columns.status}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {copy.contacts.columns.updated}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/crm/contacts/${c.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.company}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {c.email}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={c.status}
                        label={copy.statuses[c.status]}
                      />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(c.updatedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {canWrite ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border p-4"
            aria-labelledby="crm-new-contact"
          >
            <h2 id="crm-new-contact" className="text-base font-semibold">
              {copy.contacts.newTitle}
            </h2>
            <ContactForm />
          </section>
        ) : null}
      </div>
    </div>
  )
}
