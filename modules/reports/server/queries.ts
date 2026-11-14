import { getKysely } from "@/server/db/pool"

import { dashboardSchema, type Dashboard } from "../contracts/definition"
import {
  buildCardQuery,
  fillSeries,
  toNumber,
  type BreakdownRow,
} from "./engine"
import type { Card } from "../contracts/definition"

export type StoredDashboard =
  | { id: string; ok: true; dashboard: Dashboard }
  | { id: string; ok: false }

function parse(id: string, definition: unknown): StoredDashboard {
  const r = dashboardSchema.safeParse(definition)
  if (!r.success) {
    console.error(`[reports] invalid definition for dashboard "${id}"`, r.error.issues)
    return { id, ok: false }
  }
  return { id, ok: true, dashboard: r.data }
}

export async function listDashboards(): Promise<StoredDashboard[]> {
  const rows = await getKysely()
    .selectFrom("reports_dashboards")
    .select(["id", "definition"])
    .orderBy("position", "asc")
    .orderBy("id", "asc")
    .limit(100)
    .execute()
  return rows.map((r) => parse(r.id, r.definition))
}

export async function getDashboard(id: string): Promise<StoredDashboard | null> {
  const row = await getKysely()
    .selectFrom("reports_dashboards")
    .select(["id", "definition"])
    .where("id", "=", id)
    .executeTakeFirst()
  return row ? parse(row.id, row.definition) : null
}

export type CardResult =
  | { kind: "kpi"; value: number | null }
  | { kind: "series"; points: { bucket: Date; value: number | null }[] }
  | {
      kind: "breakdown"
      rows: { label: BreakdownRow["label"]; value: number | null }[]
    }
  | { kind: "error" }

/** Runs one card. A failure (a listed column that does not exist, a timeout) becomes an error result, not a broken page. */
export async function runCard(
  dashboard: Dashboard,
  card: Card,
  now = new Date()
): Promise<CardResult> {
  const db = getKysely()
  try {
    const q = buildCardQuery(dashboard, card, now)
    if (q.kind === "kpi") {
      const { rows } = await q.query.execute(db)
      return { kind: "kpi", value: toNumber(rows[0]?.value) ?? (card.metric.fn === "count" ? 0 : null) }
    }
    if (q.kind === "series") {
      const { rows } = await q.query.execute(db)
      return { kind: "series", points: fillSeries(q.buckets, rows, card.metric) }
    }
    const { rows } = await q.query.execute(db)
    return {
      kind: "breakdown",
      rows: rows.map((r) => ({ label: r.label, value: toNumber(r.value) })),
    }
  } catch (err) {
    console.error(`[reports] card "${dashboard.id}/${card.id}" failed`, err)
    return { kind: "error" }
  }
}

export async function runDashboard(dashboard: Dashboard): Promise<CardResult[]> {
  const now = new Date()
  return Promise.all(dashboard.cards.map((c) => runCard(dashboard, c, now)))
}
