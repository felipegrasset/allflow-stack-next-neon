/**
 * Aggregates stored answers into per-field results. Pure. Tolerant on
 * purpose: a stored answer that no longer fits its field (the definition
 * changed, or the row was edited by hand) is ignored, never thrown on.
 */
import type { Answers } from "./answers"
import type { FormDefinition } from "./definition"

export type FieldSummary =
  | { id: string; kind: "choice"; answered: number; counts: { value: string; count: number }[] }
  | {
      id: string
      kind: "numeric"
      answered: number
      average: number | null
      min: number | null
      max: number | null
      /** Scale only: one bucket per value, from..to. */
      distribution: { value: number; count: number }[]
    }
  | { id: string; kind: "text"; answered: number; latest: string[] }
  | { id: string; kind: "date"; answered: number; earliest: string | null; latest: string | null }
  | { id: string; kind: "consent"; answered: number }

export type FormSummary = { total: number; fields: FieldSummary[] }

/** How many recent free-text answers a summary keeps per field. */
export const LATEST_TEXT_LIMIT = 10

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * `rows` must be newest first (that is how the free-text "latest" are picked).
 */
export function summarize(def: FormDefinition, rows: readonly Answers[]): FormSummary {
  const fields = def.fields.map((f): FieldSummary => {
    const values = rows.map((r) => (Object.hasOwn(r, f.id) ? r[f.id] : undefined))
    switch (f.type) {
      case "single":
      case "multiple": {
        const counts = f.options.map((o) => ({ value: o.value, count: 0 }))
        let answered = 0
        for (const v of values) {
          const picked = typeof v === "string" ? [v] : Array.isArray(v) ? v : []
          let hit = false
          for (const p of new Set(picked)) {
            const c = counts.find((x) => x.value === p)
            if (c) {
              c.count++
              hit = true
            }
          }
          if (hit) answered++
        }
        return { id: f.id, kind: "choice", answered, counts }
      }
      case "number":
      case "scale": {
        const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        const distribution =
          f.type === "scale"
            ? Array.from({ length: f.to - f.from + 1 }, (_, i) => ({
                value: f.from + i,
                count: nums.filter((n) => n === f.from + i).length,
              }))
            : []
        const usable = f.type === "scale" ? nums.filter((n) => n >= f.from && n <= f.to) : nums
        return {
          id: f.id,
          kind: "numeric",
          answered: usable.length,
          average: usable.length ? round2(usable.reduce((a, b) => a + b, 0) / usable.length) : null,
          min: usable.length ? Math.min(...usable) : null,
          max: usable.length ? Math.max(...usable) : null,
          distribution,
        }
      }
      case "text":
      case "textarea":
      case "email": {
        const texts = values.filter((v): v is string => typeof v === "string" && v !== "")
        return { id: f.id, kind: "text", answered: texts.length, latest: texts.slice(0, LATEST_TEXT_LIMIT) }
      }
      case "date": {
        const dates = values.filter((v): v is string => typeof v === "string" && v !== "").sort()
        return {
          id: f.id,
          kind: "date",
          answered: dates.length,
          earliest: dates[0] ?? null,
          latest: dates.at(-1) ?? null,
        }
      }
      case "consent":
        return { id: f.id, kind: "consent", answered: values.filter((v) => v === true).length }
    }
  })
  return { total: rows.length, fields }
}
