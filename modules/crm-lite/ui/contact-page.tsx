import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { getContact, listContactDeals } from "../server/mutations"
import { listActivities } from "../server/queries"
import { ActivityForm } from "./activity-form"
import { ContactForm } from "./contact-form"
import { DealForm } from "./deal-form"
import { asLocale, formatMoney } from "./format"
import { StatusBadge } from "./status-badge"

/** /crm/contacts/[id] — contact card: details, deals and activity timeline. */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requirePagePermission(`/crm/contacts/${id}`, ["contact", "read"])
  if (id.length > 100) notFound()
  const contact = await getContact(id)
  if (!contact) notFound()
  const [copy, locale, canWrite, canDeals, canWriteDeals] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    can("contact", "write"),
    can("deal", "read"),
    can("deal", "write"),
  ])
  const [deals, activities] = await Promise.all([
    canDeals ? listContactDeals(id) : Promise.resolve([]),
    listActivities(id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/crm/contacts"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {copy.contact.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{contact.name}</h1>
          <StatusBadge
            status={contact.status}
            label={copy.statuses[contact.status]}
          />
        </div>
        {contact.company || contact.email || contact.phone ? (
          <p className="text-sm text-muted-foreground">
            {[contact.company, contact.email, contact.phone]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          {canDeals ? (
            <section className="flex flex-col gap-3" aria-labelledby="crm-deals">
              <h2 id="crm-deals" className="text-base font-semibold">
                {copy.contact.dealsTitle}
              </h2>
              {deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {copy.contact.dealsEmpty}
                </p>
              ) : (
                <ul
                  className="flex flex-col divide-y divide-border rounded-xl border border-border"
                  aria-label={copy.contact.dealsLabel}
                >
                  {deals.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <span className="text-sm font-medium">{d.name}</span>
                      <span className="flex items-center gap-3 text-sm">
                        <span className="tabular-nums">
                          {formatMoney(d.amountMinor, d.currency, locale)}
                        </span>
                        <span className="text-muted-foreground">
                          {copy.stages[d.stage]}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="crm-activity">
            <h2 id="crm-activity" className="text-base font-semibold">
              {copy.contact.activityTitle}
            </h2>
            {canWrite ? (
              <div className="rounded-xl border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {copy.contact.logTitle}
                </h3>
                <ActivityForm
                  contactId={contact.id}
                  deals={deals.map((d) => ({ id: d.id, name: d.name }))}
                />
              </div>
            ) : null}
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.contact.activityEmpty}
              </p>
            ) : (
              <ol
                className="flex flex-col gap-3"
                aria-label={copy.contact.activityLabel}
              >
                {activities.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-1 border-l-2 border-border pl-3"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {copy.kinds[a.kind]}
                    </span>
                    {a.kind === "stage_change" && a.fromStage && a.toStage ? (
                      <p className="text-sm">
                        {copy.contact.stageChange(
                          a.dealName ?? copy.contact.deletedDeal,
                          copy.stages[a.fromStage],
                          copy.stages[a.toStage]
                        )}
                      </p>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {a.dealName ? `${a.dealName}: ` : ""}
                        {a.body}
                      </p>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {copy.contact.meta(
                        a.authorName ?? copy.contact.unknownAuthor,
                        formatDateTime(a.createdAt, locale)
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {canWrite ? (
            <section
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              aria-labelledby="crm-edit-contact"
            >
              <h2 id="crm-edit-contact" className="text-base font-semibold">
                {copy.contact.editTitle}
              </h2>
              <ContactForm contact={contact} />
            </section>
          ) : contact.notes ? (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {contact.notes}
            </p>
          ) : null}
          {canWriteDeals ? (
            <section
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              aria-labelledby="crm-new-deal"
            >
              <h2 id="crm-new-deal" className="text-base font-semibold">
                {copy.contact.newDealTitle}
              </h2>
              <DealForm contactId={contact.id} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
