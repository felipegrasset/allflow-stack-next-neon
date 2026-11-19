/**
 * The dashboard definition: data, validated with Zod. Pure (no server or
 * client APIs) so the engine, the UI, the tests and other modules can use it.
 *
 * Safety model:
 *   - A dashboard declares its own `sources`: the WHITELIST of tables and
 *     columns its cards may read. Cards are checked against it.
 *   - Sources are set by code (`defineDashboard` + `saveDashboard`), never by a
 *     form: the edit actions only reorder or remove cards, re-validated against
 *     the stored sources.
 *   - Identifiers must be plain names (no dots, quotes or spaces), the engine
 *     quotes them with Kysely (`sql.table` / `sql.ref`) and binds every value.
 *   - Auth and migration tables, and columns that look like secrets, are
 *     rejected even if a definition lists them (defence in depth).
 */
import { z } from "zod"

/** A plain SQL identifier: letters, digits and `_`, at most 63 chars. */
export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/

/** Tables a dashboard may never read, whatever its definition says. */
export const DENIED_TABLES = [
  "session",
  "account",
  "verification",
  "kysely_migration",
  "kysely_migration_lock",
  "rate_limit_hit",
  "organizationRole",
] as const

/** Column names that look like credentials are never readable. */
export const DENIED_COLUMN = /pass|secret|token|hash|salt|api_?key/i

export const COLUMN_TYPES = ["number", "text", "date", "boolean"] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

export const INTERVALS = ["day", "week", "month"] as const
export type Interval = (typeof INTERVALS)[number]

export const FILTER_OPS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "null",
  "not_null",
] as const
export type FilterOp = (typeof FILTER_OPS)[number]

const identifier = z.string().regex(IDENTIFIER)

/** Visible text of a definition: one string, or one per locale. */
export const textSchema = z.union([
  z.string().trim().min(1).max(120),
  z.object({
    es: z.string().trim().min(1).max(120),
    en: z.string().trim().min(1).max(120),
  }),
])
export type LocalizedText = z.infer<typeof textSchema>

export const sourceSchema = z.object({
  table: identifier.refine(
    (t) => !(DENIED_TABLES as readonly string[]).includes(t),
    "table not allowed"
  ),
  /** Column used for date ranges and series (must be listed as "date"). */
  dateColumn: identifier.optional(),
  columns: z
    .record(identifier, z.enum(COLUMN_TYPES))
    .refine((c) => Object.keys(c).length <= 50, "at most 50 columns")
    .refine(
      (c) => Object.keys(c).every((name) => !DENIED_COLUMN.test(name)),
      "column not allowed"
    ),
})
export type Source = z.infer<typeof sourceSchema>

export const metricSchema = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("count") }),
  z.object({ fn: z.literal("sum"), column: identifier }),
  z.object({ fn: z.literal("avg"), column: identifier }),
])
export type Metric = z.infer<typeof metricSchema>

export const filterSchema = z.object({
  column: identifier,
  op: z.enum(FILTER_OPS),
  value: z.union([z.string().max(200), z.number(), z.boolean()]).optional(),
})
export type Filter = z.infer<typeof filterSchema>

const cardBase = {
  /** Stable within the dashboard (kebab or snake case). */
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,62}$/),
  title: textSchema,
  /** A key of the dashboard's `sources`. */
  source: identifier,
  metric: metricSchema.default({ fn: "count" }),
  filters: z.array(filterSchema).max(5).default([]),
}

export const cardSchema = z.discriminatedUnion("kind", [
  /** One number: count, sum or average. */
  z.object({
    kind: z.literal("kpi"),
    ...cardBase,
    /** ISO 4217 code: the value is formatted as money (major unit). */
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
  /** One value per day, week or month: the last `points` buckets, up to now. */
  z.object({
    kind: z.literal("series"),
    ...cardBase,
    interval: z.enum(INTERVALS),
    points: z.number().int().min(2).max(366).default(12),
  }),
  /** The metric grouped by a column, largest first. */
  z.object({
    kind: z.literal("breakdown"),
    ...cardBase,
    by: identifier,
    limit: z.number().int().min(1).max(20).default(8),
  }),
])
export type Card = z.infer<typeof cardSchema>
export type CardKind = Card["kind"]

export const dashboardSchema = z
  .object({
    /** URL slug: `/reports/<id>`. */
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
    title: textSchema,
    description: textSchema.optional(),
    /**
     * KPIs and breakdowns only count rows of the last `rangeDays` days (on the
     * source's `dateColumn`). Omitted: all time. Series use their own `points`.
     */
    rangeDays: z.number().int().min(1).max(3650).optional(),
    sources: z
      .record(identifier, sourceSchema)
      .refine((s) => Object.keys(s).length >= 1, "at least one source")
      .refine((s) => Object.keys(s).length <= 10, "at most 10 sources"),
    cards: z.array(cardSchema).max(24),
  })
  .superRefine((d, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message })

    for (const [key, s] of Object.entries(d.sources)) {
      if (s.dateColumn && s.columns[s.dateColumn] !== "date")
        issue(["sources", key, "dateColumn"], "dateColumn must be a listed date column")
    }

    const seen = new Set<string>()
    d.cards.forEach((card, i) => {
      const at = (...p: (string | number)[]) => ["cards", i, ...p]
      if (seen.has(card.id)) issue(at("id"), `duplicate card id "${card.id}"`)
      seen.add(card.id)

      const source = d.sources[card.source]
      if (!source) {
        issue(at("source"), `unknown source "${card.source}"`)
        return
      }
      const typeOf = (c: string) => source.columns[c] as ColumnType | undefined

      if (card.metric.fn !== "count" && typeOf(card.metric.column) !== "number")
        issue(at("metric", "column"), "sum and avg need a listed number column")

      card.filters.forEach((f, j) => {
        const t = typeOf(f.column)
        if (!t) return issue(at("filters", j, "column"), `column "${f.column}" is not listed`)
        if (f.op === "null" || f.op === "not_null") {
          if (f.value !== undefined) issue(at("filters", j, "value"), "null checks take no value")
          return
        }
        if (f.value === undefined) return issue(at("filters", j, "value"), "value required")
        const ok =
          t === "number"
            ? typeof f.value === "number" && Number.isFinite(f.value)
            : t === "boolean"
              ? typeof f.value === "boolean" && (f.op === "eq" || f.op === "neq")
              : t === "date"
                ? typeof f.value === "string" && !Number.isNaN(Date.parse(f.value))
                : typeof f.value === "string"
        if (!ok) issue(at("filters", j, "value"), `value does not fit a ${t} column with "${f.op}"`)
      })

      if (card.kind === "series" && !source.dateColumn)
        issue(at("source"), "a series needs a source with dateColumn")
      if (card.kind === "breakdown") {
        const t = typeOf(card.by)
        if (t !== "text" && t !== "boolean")
          issue(at("by"), "breakdown needs a listed text or boolean column")
      }
    })
  })

export type Dashboard = z.infer<typeof dashboardSchema>
export type DashboardInput = z.input<typeof dashboardSchema>

/**
 * Validates a definition and returns it with defaults applied. Throws a
 * ZodError when it is invalid (unknown column, denied table, wrong type…).
 */
export function defineDashboard(input: DashboardInput): Dashboard {
  return dashboardSchema.parse(input)
}

/** The text of a definition in the given locale (a plain string is used as is). */
export function resolveText(text: LocalizedText, locale: "es" | "en"): string {
  return typeof text === "string" ? text : text[locale]
}
