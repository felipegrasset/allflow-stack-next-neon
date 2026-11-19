import { formatDate, formatNumber, type Locale } from "@/modules/i18n/contracts"
import type { ModuleCopy } from "@/modules/i18n/contracts/server"

import { resolveText, type FormDefinition } from "../contracts/definition"
import type { FieldSummary, FormSummary } from "../contracts/summary"
import type { es } from "../messages"

type Copy = ModuleCopy<typeof es>

/** A horizontal bar. Decorative: the count and percentage are always written next to it. */
function Bar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="h-2 w-full rounded-full bg-muted" aria-hidden>
      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Rows({ rows, total, locale }: { rows: { key: string; label: string; count: number }[]; total: number; locale: Locale }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="text-muted-foreground">
              {`${formatNumber(r.count, locale)} · ${total ? Math.round((r.count / total) * 100) : 0}%`}
            </span>
          </div>
          <Bar ratio={total ? r.count / total : 0} />
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  )
}

function Body({
  field,
  summary,
  def,
  total,
  copy,
  locale,
}: {
  field: FormDefinition["fields"][number]
  summary: FieldSummary
  def: FormDefinition
  total: number
  copy: Copy
  locale: Locale
}) {
  void def
  switch (summary.kind) {
    case "choice": {
      if (field.type !== "single" && field.type !== "multiple") return null
      const rows = summary.counts.map((c) => ({
        key: c.value,
        label: resolveText(field.options.find((o) => o.value === c.value)?.label ?? c.value, locale),
        count: c.count,
      }))
      return <Rows rows={rows} total={total} locale={locale} />
    }
    case "numeric": {
      const n = (v: number | null) => (v === null ? "—" : formatNumber(v, locale))
      return (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-wrap gap-6">
            <Stat label={copy.detail.average} value={n(summary.average)} />
            <Stat label={copy.detail.min} value={n(summary.min)} />
            <Stat label={copy.detail.max} value={n(summary.max)} />
          </dl>
          {summary.distribution.length > 0 ? (
            <Rows
              rows={summary.distribution.map((d) => ({ key: String(d.value), label: String(d.value), count: d.count }))}
              total={summary.answered}
              locale={locale}
            />
          ) : null}
        </div>
      )
    }
    case "text":
      return summary.latest.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {summary.latest.map((t, i) => (
            <li key={i} className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line">
              {t}
            </li>
          ))}
        </ul>
      )
    case "date":
      return summary.earliest === null || summary.latest === null ? null : (
        <dl className="flex flex-wrap gap-6">
          <Stat label={copy.detail.earliest} value={formatDate(`${summary.earliest}T12:00:00Z`, locale)} />
          <Stat label={copy.detail.latest} value={formatDate(`${summary.latest}T12:00:00Z`, locale)} />
        </dl>
      )
    case "consent":
      return <p className="text-sm">{copy.detail.consentCount(summary.answered)}</p>
  }
}

/** One block per question with its aggregate. Server component. */
export function SummaryView({
  def,
  summary,
  copy,
  locale,
}: {
  def: FormDefinition
  summary: FormSummary
  copy: Copy
  locale: Locale
}) {
  return (
    <div className="flex flex-col gap-4">
      {def.fields.map((field) => {
        const s = summary.fields.find((x) => x.id === field.id)
        if (!s) return null
        return (
          <section
            key={field.id}
            aria-labelledby={`forms-q-${field.id}`}
            className="flex flex-col gap-3 rounded-xl border border-border p-4"
          >
            <div className="flex flex-col gap-0.5">
              <h3 id={`forms-q-${field.id}`} className="text-sm font-medium">
                {resolveText(field.label, locale)}
              </h3>
              <p className="text-xs text-muted-foreground">{copy.detail.answered(s.answered, summary.total)}</p>
            </div>
            <Body field={field} summary={s} def={def} total={summary.total} copy={copy} locale={locale} />
          </section>
        )
      })}
    </div>
  )
}
