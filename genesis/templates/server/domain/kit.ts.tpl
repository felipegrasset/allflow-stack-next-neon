/**
 * Server helpers shared by the generated queries and actions. Copied verbatim
 * by AllFlow's genesis from `genesis/templates/server/domain/kit.ts`.
 */

export const PAGE_SIZE = 20

/** `?page=` → a positive integer (1 when missing or nonsense). */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1
}

/** `?q=` → an `ilike` pattern with the wildcards of the user's text escaped; null when empty. */
export function likePattern(value: string | string[] | undefined): string | null {
  const q = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100)
  if (!q) return null
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A route param that must be a uuid; anything else is a 404, not a database error. */
export function parseId(value: string): string | null {
  return UUID.test(value) ? value.toLowerCase() : null
}

/** Postgres error code of a failed query (`23503` = foreign key violation), whatever the driver. */
export function dbErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined
}

/**
 * Seed values: plain JSON, except dates, which are stored relative to the day
 * the seed runs (`{ "$days": 3 }`) so the sample data is never in the past.
 */
export type SeedValue = string | number | boolean | null | { $days: number; $time?: string }

export function resolveSeedValue(value: SeedValue, kind: "date" | "datetime", now: Date = new Date()): string | null {
  if (value === null) return null
  if (typeof value !== "object") return String(value)
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + value.$days))
  const day = d.toISOString().slice(0, 10)
  return kind === "date" ? day : `${day}T${value.$time ?? "09:00"}`
}
