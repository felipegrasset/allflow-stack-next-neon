import { notFound } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import {
  INTL_TAG,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  type Locale,
} from "@/modules/i18n/contracts"
import { getModuleCopy, type ModuleCopy } from "@/modules/i18n/contracts/server"

import { resolveText, type Card, type Interval } from "../contracts/definition"
import { es } from "../messages"
import { hasReportPermission, requireReportPermission } from "../server/access"
import { moveCardAction, removeCardAction } from "../server/actions"
import { requestLocale } from "../server/locale"
import { getDashboard, runDashboard, type CardResult } from "../server/queries"
import { BreakdownBars } from "./breakdown-bars"
import { CardFrame } from "./card-frame"
import { EmptyState } from "./empty-state"
import { KpiValue } from "./kpi-value"
import { SeriesChart } from "./series-chart"

type Copy = ModuleCopy<typeof es>

const DASHBOARD_ID = /^[a-z0-9][a-z0-9-]{0,62}$/

function formatValue(v: number | null, card: Card, locale: Locale, copy: Copy): string {
  if (v === null) return copy.card.noData
  if (card.kind === "kpi" && card.currency) return formatCurrency(v, card.currency, locale)
  return formatNumber(v, locale, { maximumFractionDigits: 2 })
}

function bucketLabel(d: Date, interval: Interval, locale: Locale): string {
  if (interval === "month")
    return new Intl.DateTimeFormat(INTL_TAG[locale], {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(d)
  return formatDate(d, locale, "short", "UTC")
}

function intervalLabel(interval: Interval, copy: Copy): string {
  return interval === "day" ? copy.card.byDay : interval === "week" ? copy.card.byWeek : copy.card.byMonth
}

function CardBody({
  card,
  result,
  title,
  locale,
  copy,
}: {
  card: Card
  result: CardResult
  title: string
  locale: Locale
  copy: Copy
}) {
  if (result.kind === "error")
    return <p className="text-sm text-destructive">{copy.card.error}</p>
  if (result.kind === "kpi")
    return <KpiValue value={formatValue(result.value, card, locale, copy)} muted={result.value === null} />
  if (result.kind === "series" && card.kind === "series") {
    const points = result.points.map((p) => ({
      label: bucketLabel(p.bucket, card.interval, locale),
      value: p.value,
      display: formatValue(p.value, card, locale, copy),
    }))
    if (points.every((p) => p.value === null))
      return <KpiValue value={copy.card.noData} muted />
    return (
      <SeriesChart
        points={points}
        caption={title}
        alt={copy.card.seriesAlt(title, points.length, points[0].label, points[points.length - 1].label)}
        periodLabel={copy.card.period}
        valueLabel={copy.card.value}
      />
    )
  }
  if (result.kind === "breakdown") {
    if (result.rows.length === 0) return <KpiValue value={copy.card.noData} muted />
    const items = result.rows.map((r) => ({
      label:
        r.label === null || r.label === ""
          ? copy.card.emptyLabel
          : typeof r.label === "boolean"
            ? r.label
              ? copy.card.yes
              : copy.card.no
            : String(r.label),
      value: r.value,
      display: formatValue(r.value, card, locale, copy),
    }))
    return <BreakdownBars items={items} label={title} />
  }
  return null
}

function EditControls({
  dashboardId,
  card,
  title,
  first,
  last,
  copy,
}: {
  dashboardId: string
  card: Card
  title: string
  first: boolean
  last: boolean
  copy: Copy
}) {
  const hidden = (
    <>
      <input type="hidden" name="dashboardId" value={dashboardId} />
      <input type="hidden" name="cardId" value={card.id} />
    </>
  )
  return (
    <div role="group" aria-label={copy.edit.group(title)} className="flex shrink-0 gap-1">
      {!first ? (
        <form action={moveCardAction}>
          {hidden}
          <input type="hidden" name="direction" value="up" />
          <Button type="submit" variant="ghost" size="xs">{copy.edit.up}</Button>
        </form>
      ) : null}
      {!last ? (
        <form action={moveCardAction}>
          {hidden}
          <input type="hidden" name="direction" value="down" />
          <Button type="submit" variant="ghost" size="xs">{copy.edit.down}</Button>
        </form>
      ) : null}
      <form action={removeCardAction}>
        {hidden}
        <Button type="submit" variant="ghost" size="xs">{copy.edit.remove}</Button>
      </form>
    </div>
  )
}

/** /reports/[id] — one dashboard, computed on each request (needs `report:view`; edit controls with `report:edit`). */
export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireReportPermission("view", `/reports/${encodeURIComponent(id)}`)
  if (!DASHBOARD_ID.test(id)) notFound()
  const [stored, copy, locale, canEdit] = await Promise.all([
    getDashboard(id),
    getModuleCopy(es),
    requestLocale(),
    hasReportPermission("edit"),
  ])
  if (!stored) notFound()

  const back = (
    <ButtonLink href="/reports" variant="ghost" size="sm" className="self-start">
      {copy.dashboard.back}
    </ButtonLink>
  )

  if (!stored.ok)
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState title={copy.dashboard.invalidTitle} description={copy.dashboard.invalidHint} />
      </div>
    )

  const d = stored.dashboard
  const results = await runDashboard(d)
  const now = new Date()

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{resolveText(d.title, locale)}</h1>
        {d.description ? (
          <p className="text-sm text-muted-foreground">{resolveText(d.description, locale)}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {d.rangeDays ? copy.dashboard.rangeDays(d.rangeDays) : copy.dashboard.allTime}
          {" · "}
          {copy.dashboard.computedAt(formatDateTime(now, locale))}
        </p>
      </div>
      {d.cards.length === 0 ? (
        <EmptyState title={copy.dashboard.emptyTitle} description={copy.dashboard.emptyHint} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.cards.map((card, i) => {
            const title = resolveText(card.title, locale)
            return (
              <CardFrame
                key={card.id}
                title={title}
                subtitle={card.kind === "series" ? intervalLabel(card.interval, copy) : undefined}
                className={card.kind === "series" ? "sm:col-span-2" : undefined}
                actions={
                  canEdit ? (
                    <EditControls
                      dashboardId={d.id}
                      card={card}
                      title={title}
                      first={i === 0}
                      last={i === d.cards.length - 1}
                      copy={copy}
                    />
                  ) : undefined
                }
              >
                <CardBody card={card} result={results[i]} title={title} locale={locale} copy={copy} />
              </CardFrame>
            )
          })}
        </div>
      )}
      {d.cards.some((c) => c.kind === "series") ? (
        <p className="text-xs text-muted-foreground">{copy.dashboard.utc}</p>
      ) : null}
    </div>
  )
}
