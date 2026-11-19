/**
 * Turns a validated card into a query. Pure: it only builds Kysely `sql`
 * fragments (identifiers through `sql.table` / `sql.ref`, which quote them;
 * every value is a bound parameter). Nothing here runs a query or imports the
 * database, so tests compile the result with a dummy dialect.
 *
 * Callers must pass a definition that went through `dashboardSchema`: the
 * whitelist and the identifier rules are enforced there, and checked again
 * here (`assertListed`) so a hand-built object cannot slip a name through.
 */
import { sql, type RawBuilder } from "kysely"

import {
  IDENTIFIER,
  type Card,
  type Dashboard,
  type Filter,
  type Interval,
  type Metric,
  type Source,
} from "../contracts/definition"

export type ValueRow = { value: string | number | null }
export type SeriesRow = { bucket: Date | string; value: string | number | null }
export type BreakdownRow = {
  label: string | number | boolean | null
  value: string | number | null
}

function assertListed(source: Source, column: string): void {
  if (!IDENTIFIER.test(column) || !(column in source.columns))
    throw new Error(`reports: column "${column}" is not in the source whitelist`)
}

function metricSql(source: Source, metric: Metric): RawBuilder<unknown> {
  if (metric.fn === "count") return sql`count(*)`
  assertListed(source, metric.column)
  const col = sql.ref(metric.column)
  return metric.fn === "sum" ? sql`sum(${col})` : sql`avg(${col})`
}

function filterSql(source: Source, f: Filter): RawBuilder<unknown> {
  assertListed(source, f.column)
  const col = sql.ref(f.column)
  const v = f.value
  switch (f.op) {
    case "null":
      return sql`${col} is null`
    case "not_null":
      return sql`${col} is not null`
    case "eq":
      return sql`${col} = ${v}`
    case "neq":
      return sql`${col} is distinct from ${v}`
    case "gt":
      return sql`${col} > ${v}`
    case "gte":
      return sql`${col} >= ${v}`
    case "lt":
      return sql`${col} < ${v}`
    case "lte":
      return sql`${col} <= ${v}`
  }
}

function whereSql(
  source: Source,
  filters: Filter[],
  since: Date | null
): RawBuilder<unknown> {
  const parts = filters.map((f) => filterSql(source, f))
  if (since && source.dateColumn) {
    assertListed(source, source.dateColumn)
    parts.push(sql`${sql.ref(source.dateColumn)} >= ${since}`)
  }
  return parts.length ? sql.join(parts, sql` and `) : sql`true`
}

/** Start (UTC) of the bucket that contains `d`; weeks start on Monday, like Postgres' date_trunc. */
export function bucketStart(d: Date, interval: Interval): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  if (interval === "month") return new Date(Date.UTC(y, m, 1))
  const day = new Date(Date.UTC(y, m, d.getUTCDate()))
  if (interval === "week") {
    const dow = (day.getUTCDay() + 6) % 7 // Monday = 0
    day.setUTCDate(day.getUTCDate() - dow)
  }
  return day
}

/** `n` buckets back (negative) or forward from a bucket start. */
export function addBuckets(d: Date, interval: Interval, n: number): Date {
  const out = new Date(d.getTime())
  if (interval === "month") out.setUTCMonth(out.getUTCMonth() + n)
  else out.setUTCDate(out.getUTCDate() + n * (interval === "week" ? 7 : 1))
  return out
}

/** The bucket starts a series shows, oldest first, ending at the bucket of `now`. */
export function seriesBuckets(interval: Interval, points: number, now: Date): Date[] {
  const last = bucketStart(now, interval)
  return Array.from({ length: points }, (_, i) =>
    addBuckets(last, interval, i - (points - 1))
  )
}

const DAY_MS = 86_400_000

export type CardQuery =
  | { kind: "kpi"; query: RawBuilder<ValueRow> }
  | { kind: "series"; query: RawBuilder<SeriesRow>; buckets: Date[] }
  | { kind: "breakdown"; query: RawBuilder<BreakdownRow> }

/** Builds the query of one card. `now` is injected so tests are deterministic. */
export function buildCardQuery(
  dashboard: Dashboard,
  card: Card,
  now: Date
): CardQuery {
  const source = dashboard.sources[card.source]
  if (!source) throw new Error(`reports: unknown source "${card.source}"`)
  const table = sql.table(source.table)
  const metric = metricSql(source, card.metric)

  if (card.kind === "series") {
    const dateColumn = source.dateColumn
    if (!dateColumn) throw new Error("reports: a series needs a dateColumn")
    assertListed(source, dateColumn)
    const buckets = seriesBuckets(card.interval, card.points, now)
    const where = whereSql(source, card.filters, buckets[0])
    return {
      kind: "series",
      buckets,
      query: sql<SeriesRow>`select date_trunc(${card.interval}::text, ${sql.ref(dateColumn)}) as bucket, ${metric} as value from ${table} where ${where} group by 1 order by 1`,
    }
  }

  const since =
    dashboard.rangeDays && source.dateColumn
      ? new Date(now.getTime() - dashboard.rangeDays * DAY_MS)
      : null
  const where = whereSql(source, card.filters, since)

  if (card.kind === "kpi")
    return {
      kind: "kpi",
      query: sql<ValueRow>`select ${metric} as value from ${table} where ${where}`,
    }

  assertListed(source, card.by)
  return {
    kind: "breakdown",
    query: sql<BreakdownRow>`select ${sql.ref(card.by)} as label, ${metric} as value from ${table} where ${where} group by 1 order by 2 desc nulls last limit ${card.limit}`,
  }
}

/** Postgres returns count/sum/avg as text (bigint/numeric): to a number, or null. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const dayKey = (d: Date | string) =>
  (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10)

/**
 * One point per bucket, in order. A bucket with no rows is 0 for count and
 * sum (nothing happened) and null for avg (no data, not "zero average").
 */
export function fillSeries(
  buckets: Date[],
  rows: SeriesRow[],
  metric: Metric
): { bucket: Date; value: number | null }[] {
  const byKey = new Map(rows.map((r) => [dayKey(r.bucket), toNumber(r.value)]))
  const empty = metric.fn === "avg" ? null : 0
  return buckets.map((bucket) => {
    const key = dayKey(bucket)
    return { bucket, value: byKey.has(key) ? (byKey.get(key) ?? empty) : empty }
  })
}
