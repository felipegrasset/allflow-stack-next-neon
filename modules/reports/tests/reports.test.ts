/**
 * reports v0.1 — what can be tested without a database: the definition's
 * validation (whitelist, denied tables and columns, types), the SQL the engine
 * builds (compiled with a dummy Postgres dialect: identifiers quoted, values
 * bound, never interpolated), the bucket arithmetic, the card edits, the chart
 * geometry, and — reading the code — that every action and page goes through
 * the permission guard.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  dashboardSchema,
  defineDashboard,
  resolveText,
  type Dashboard,
  type DashboardInput,
} from "../contracts/definition"
import { usersDashboard } from "../demo"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { moveCardIn, removeCardIn } from "../server/edit"
import {
  bucketStart,
  buildCardQuery,
  fillSeries,
  seriesBuckets,
  toNumber,
} from "../server/engine"
import { barWidths, BreakdownBars } from "../ui/breakdown-bars"
import { layoutSeries, linePath } from "../ui/series-chart"

/** Fixture text, not UI copy: keeps the literal-text scanner (tests/i18n.test.ts) quiet. */
const lit = (s: string) => s

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new Kysely<any>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createIntrospector: (k: Kysely<any>) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
})

const base: DashboardInput = {
  id: "ventas",
  title: lit("Ventas"),
  rangeDays: 30,
  sources: {
    orders: {
      table: "orders",
      dateColumn: "created_at",
      columns: { created_at: "date", total: "number", status: "text", paid: "boolean" },
    },
  },
  cards: [
    { kind: "kpi", id: "count", title: lit("Pedidos"), source: "orders" },
    { kind: "kpi", id: "revenue", title: lit("Ingresos"), source: "orders", metric: { fn: "sum", column: "total" }, currency: "CLP" },
    { kind: "series", id: "daily", title: lit("Por día"), source: "orders", interval: "day", points: 7 },
    { kind: "breakdown", id: "status", title: lit("Estado"), source: "orders", by: "status", metric: { fn: "avg", column: "total" } },
  ],
}

const withCards = (cards: DashboardInput["cards"]): DashboardInput => ({ ...base, cards })
const invalid = (d: DashboardInput) => dashboardSchema.safeParse(d).success === false

// ── definition ──────────────────────────────────────────────────────────────

test("definition: a valid dashboard parses and gets defaults", () => {
  const d = defineDashboard(base)
  assert.equal(d.cards[0].metric.fn, "count")
  assert.deepEqual(d.cards[0].filters, [])
  const b = d.cards[3]
  assert.equal(b.kind === "breakdown" && b.limit, 8)
})

test("definition: the demo dashboard is valid and leaves out personal columns", () => {
  const cols = Object.keys(usersDashboard.sources.users.columns)
  for (const c of ["email", "name", "image"]) assert.ok(!cols.includes(c), c)
})

test("definition: identifiers must be plain names", () => {
  for (const table of ['orders"; drop table x; --', "public.orders", "or ders", "1orders", ""]) {
    assert.ok(invalid({ ...base, sources: { orders: { ...base.sources.orders, table } } }), table)
  }
  assert.ok(invalid({ ...base, sources: { orders: { ...base.sources.orders, columns: { "total)": "number" } } } }))
})

test("definition: auth tables and secret-looking columns are denied", () => {
  for (const table of ["session", "account", "verification", "kysely_migration", "rate_limit_hit"])
    assert.ok(invalid({ ...base, sources: { orders: { ...base.sources.orders, table } } }), table)
  for (const col of ["password", "access_token", "secretKey", "pw_hash", "api_key"])
    assert.ok(
      invalid({ ...base, sources: { orders: { ...base.sources.orders, columns: { created_at: "date", [col]: "text" } } } }),
      col
    )
})

test("definition: cards may only use whitelisted columns of the right type", () => {
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "nope" }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", metric: { fn: "sum", column: "status" } }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", metric: { fn: "sum", column: "missing" } }])))
  assert.ok(invalid(withCards([{ kind: "breakdown", id: "a", title: lit("x"), source: "orders", by: "total" }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", filters: [{ column: "secret_col", op: "eq", value: 1 }] }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", filters: [{ column: "total", op: "gt", value: "10" }] }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", filters: [{ column: "paid", op: "gt", value: true }] }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders", filters: [{ column: "paid", op: "null", value: true }] }])))
  assert.ok(invalid(withCards([{ kind: "kpi", id: "a", title: lit("x"), source: "orders" }, { kind: "kpi", id: "a", title: lit("y"), source: "orders" }])))
})

test("definition: a series needs a source with a date column", () => {
  const noDate = { ...base, sources: { orders: { table: "orders", columns: { total: "number" as const } } } }
  assert.ok(invalid({ ...noDate, cards: [{ kind: "series", id: "s", title: lit("x"), source: "orders", interval: "day" }] }))
  assert.ok(invalid({ ...base, sources: { orders: { ...base.sources.orders, dateColumn: "status" } } }))
})

test("resolveText: plain string or per locale", () => {
  assert.equal(resolveText("Ventas", "en"), "Ventas")
  assert.equal(resolveText({ es: "Ventas", en: "Sales" }, "en"), "Sales")
})

// ── engine ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-11-14T15:30:00Z") // a Saturday
const def = defineDashboard(base)
const compile = (i: number) => {
  const q = buildCardQuery(def, def.cards[i], NOW)
  return { q, c: q.query.compile(db) }
}

test("engine: a KPI quotes identifiers and binds the range", () => {
  const { c } = compile(1)
  assert.equal(c.sql, 'select sum("total") as value from "orders" where "created_at" >= $1')
  assert.deepEqual(c.parameters, [new Date(NOW.getTime() - 30 * 86_400_000)])
})

test("engine: filter values are always parameters, never SQL text", () => {
  const evil = "x' or 1=1 --"
  const d = defineDashboard(
    withCards([{ kind: "kpi", id: "k", title: lit("x"), source: "orders", filters: [{ column: "status", op: "eq", value: evil }, { column: "total", op: "gte", value: 10 }] }])
  )
  const c = buildCardQuery(d, d.cards[0], NOW).query.compile(db)
  assert.ok(!c.sql.includes(evil))
  assert.equal(c.sql, 'select count(*) as value from "orders" where "status" = $1 and "total" >= $2 and "created_at" >= $3')
  assert.deepEqual(c.parameters.slice(0, 2), [evil, 10])
})

test("engine: a series groups by date_trunc with the interval as a parameter", () => {
  const { q, c } = compile(2)
  assert.equal(
    c.sql,
    'select date_trunc($1::text, "created_at") as bucket, count(*) as value from "orders" where "created_at" >= $2 group by 1 order by 1'
  )
  assert.equal(c.parameters[0], "day")
  assert.ok(q.kind === "series")
  assert.equal(q.kind === "series" && q.buckets.length, 7)
  assert.deepEqual(c.parameters[1], new Date("2026-11-08T00:00:00Z"))
})

test("engine: a breakdown orders by value and binds the limit", () => {
  const { c } = compile(3)
  assert.equal(
    c.sql,
    'select "status" as label, avg("total") as value from "orders" where "created_at" >= $1 group by 1 order by 2 desc nulls last limit $2'
  )
  assert.equal(c.parameters[1], 8)
})

test("engine: a hand-built card with an unlisted column is refused", () => {
  const forged = { ...def, cards: [{ ...def.cards[0], metric: { fn: "sum" as const, column: "password" } }] } as Dashboard
  assert.throws(() => buildCardQuery(forged, forged.cards[0], NOW), /whitelist/)
  const quoted = { ...def, cards: [{ ...def.cards[0], filters: [{ column: 'a"b', op: "eq" as const, value: 1 }] }] } as Dashboard
  assert.throws(() => buildCardQuery(quoted, quoted.cards[0], NOW), /whitelist/)
})

test("buckets: weeks start on Monday, months on the 1st (UTC)", () => {
  assert.deepEqual(bucketStart(NOW, "week"), new Date("2026-11-09T00:00:00Z"))
  assert.deepEqual(bucketStart(NOW, "month"), new Date("2026-11-01T00:00:00Z"))
  assert.deepEqual(bucketStart(NOW, "day"), new Date("2026-11-14T00:00:00Z"))
  const months = seriesBuckets("month", 3, NOW).map((d) => d.toISOString().slice(0, 10))
  assert.deepEqual(months, ["2026-09-01", "2026-10-01", "2026-11-01"])
  const jan = seriesBuckets("month", 2, new Date("2027-01-31T10:00:00Z")).map((d) => d.toISOString().slice(0, 7))
  assert.deepEqual(jan, ["2026-12", "2027-01"])
})

test("fillSeries: missing buckets are 0 for count/sum and null for avg", () => {
  const buckets = seriesBuckets("day", 3, NOW)
  const rows = [{ bucket: new Date("2026-11-13T00:00:00Z"), value: "4" }]
  assert.deepEqual(fillSeries(buckets, rows, { fn: "count" }).map((p) => p.value), [0, 4, 0])
  assert.deepEqual(fillSeries(buckets, rows, { fn: "avg", column: "total" }).map((p) => p.value), [null, 4, null])
})

test("toNumber: numeric text to number, null stays null", () => {
  assert.equal(toNumber("12.50"), 12.5)
  assert.equal(toNumber(null), null)
  assert.equal(toNumber("abc"), null)
})

// ── edits ───────────────────────────────────────────────────────────────────

test("edits: move and remove cards; out of range is a no-op", () => {
  assert.deepEqual(moveCardIn(def, "revenue", "up")!.cards.map((c) => c.id), ["revenue", "count", "daily", "status"])
  assert.equal(moveCardIn(def, "count", "up"), null)
  assert.equal(moveCardIn(def, "status", "down"), null)
  assert.equal(moveCardIn(def, "ghost", "down"), null)
  assert.deepEqual(removeCardIn(def, "daily")!.cards.map((c) => c.id), ["count", "revenue", "status"])
  assert.equal(removeCardIn(def, "ghost"), null)
  assert.deepEqual(moveCardIn(def, "count", "down")!.sources, def.sources)
})

// ── UI geometry and render ──────────────────────────────────────────────────

test("charts: nulls break the line; bars scale to the largest value", () => {
  const pts = layoutSeries([1, null, 3])
  assert.equal(pts[1], null)
  assert.equal(linePath(pts).match(/M/g)?.length, 2)
  assert.deepEqual(barWidths([5, 10, null, -2]), [50, 100, 0, 0])
  assert.deepEqual(barWidths([0, 0]), [0, 0])
})

test("BreakdownBars: an ordered list with text values and no literal colors", () => {
  const html = renderToStaticMarkup(
    createElement(BreakdownBars, { label: "Estado", items: [{ label: "pagado", value: 3, display: "3" }] })
  )
  assert.match(html, /<ol aria-label="Estado"/)
  assert.match(html, /bg-primary/)
  assert.doesNotMatch(html, /#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i)
})

// ── catalog, permissions, access (reading the code) ─────────────────────────

test("messages: es and en have the same keys", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(es).sort(), keys(en).sort())
})

test("permissions: report view/edit, member gets nothing by default", () => {
  assert.deepEqual(permissions.statement, { report: ["view", "edit"] })
  assert.deepEqual(permissions.grants.member, {})
})

const MOD = join(process.cwd(), "modules", "reports")
const src = (f: string) => readFileSync(join(MOD, f), "utf8")

test("access: every Server Action checks report:edit before touching data", () => {
  const bodies = src("server/actions.ts").split(/export async function /).slice(1)
  assert.ok(bodies.length >= 2)
  for (const body of bodies) {
    const guard = body.indexOf('requireReportPermission("edit"')
    const write = body.indexOf("editDashboard(")
    assert.ok(guard > 0 && write > guard, body.slice(0, body.indexOf("(")))
    assert.match(body, /safeParse/)
  }
})

test("access: both pages require report:view first", () => {
  for (const f of ["ui/page.tsx", "ui/dashboard-page.tsx"]) {
    const s = src(f)
    const body = s.slice(s.indexOf("export default async function"))
    const guard = body.indexOf('requireReportPermission("view"')
    assert.ok(guard > 0, f)
    for (const call of ["listDashboards(", "getDashboard(", "runDashboard("]) {
      const at = body.indexOf(call)
      if (at >= 0) assert.ok(guard < at, `${f}: ${call} before the guard`)
    }
  }
})

test("engine and definition never build SQL from strings", () => {
  for (const f of ["server/engine.ts", "server/queries.ts", "server/mutations.ts", "server/save.ts"])
    assert.doesNotMatch(src(f), /sql\.raw|sql\.lit|sql\.id\(/, f)
})
