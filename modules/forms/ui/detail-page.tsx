import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { answerText } from "../contracts/answers"
import { resolveText } from "../contracts/definition"
import { summarize } from "../contracts/summary"
import { es } from "../messages"
import { can, requirePagePermission } from "../server/authz"
import { getFormById, listResponses, RECENT_LIMIT, SUMMARY_SCAN_LIMIT } from "../server/store"
import { activeLocale } from "./locale"
import { StatusControls } from "./status-controls"
import { LINK_CLASS } from "./styles"
import { SummaryView } from "./summary-view"

/** Columns shown in the recent-responses table (the first fields of the form). */
const TABLE_COLUMNS = 6

export default async function FormResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePagePermission(`/forms/${encodeURIComponent(id)}`, "read")
  if (id.length > 100) notFound()
  const form = await getFormById(id)
  if (!form) notFound()
  const [copy, locale, canWrite, rows] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    can("write"),
    listResponses(form.id, SUMMARY_SCAN_LIMIT),
  ])
  const def = form.definition
  const summary = summarize(def, rows.map((r) => r.answers))
  const recent = rows.slice(0, RECENT_LIMIT)
  const columns = def.fields.slice(0, TABLE_COLUMNS)

  return (
    <div className="flex flex-col gap-6">
      <Link href="/forms" className={LINK_CLASS}>
        {copy.detail.back}
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{resolveText(def.title, locale)}</h1>
        {def.description ? <p className="text-sm text-muted-foreground">{resolveText(def.description, locale)}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={form.status === "open" ? "default" : "outline"}>{copy.status[form.status]}</Badge>
          <span>{copy.detail.total(rows.length)}</span>
          {form.onePerPerson ? <span>{`· ${copy.list.onePerPerson}`}</span> : null}
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">{`${copy.detail.publicLink}: `}</span>
          {form.status === "draft" ? (
            <span>{`/f/${form.slug}`}</span>
          ) : (
            <Link href={`/f/${form.slug}`} className={LINK_CLASS}>
              {`/f/${form.slug}`}
            </Link>
          )}
        </p>
        {form.status === "draft" ? <p className="text-xs text-muted-foreground">{copy.detail.draftNote}</p> : null}
        {form.status === "closed" ? <p className="text-xs text-muted-foreground">{copy.detail.closedNote}</p> : null}
      </div>

      {canWrite ? <StatusControls id={form.id} status={form.status} /> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.detail.noResponses}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3" aria-labelledby="forms-summary">
            <h2 id="forms-summary" className="text-base font-medium">
              {copy.detail.summaryTitle}
            </h2>
            {rows.length >= SUMMARY_SCAN_LIMIT ? (
              <p className="text-xs text-muted-foreground">{copy.detail.scanNote(SUMMARY_SCAN_LIMIT)}</p>
            ) : null}
            <SummaryView def={def} summary={summary} copy={copy} locale={locale} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="forms-recent">
            <h2 id="forms-recent" className="text-base font-medium">
              {copy.detail.recentTitle}
            </h2>
            <p className="text-xs text-muted-foreground">{copy.detail.recentNote(RECENT_LIMIT)}</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.detail.date}</TableHead>
                    {columns.map((f) => (
                      <TableHead key={f.id}>{resolveText(f.label, locale)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt, locale)}</time>
                      </TableCell>
                      {columns.map((f) => (
                        <TableCell key={f.id} className="max-w-64 truncate">
                          {answerText(f, Object.hasOwn(r.answers, f.id) ? r.answers[f.id] : undefined, locale, copy.detail.yes)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
