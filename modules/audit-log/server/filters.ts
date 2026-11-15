/** Filters of /admin/audit: parsed from the URL, pure. */
export const PAGE_SIZE = 50

export type Cursor = { at: string; id: string }

export type AuditFilters = {
  entity?: string
  /** Prefix match: "contact." finds contact.create, contact.update… */
  action?: string
  /** Exact actor id or part of the name. */
  actor?: string
  /** Inclusive start, UTC midnight. */
  from?: Date
  /** Exclusive end (the day after the chosen one, UTC midnight). */
  to?: Date
  cursor?: Cursor
}

type Params = Record<string, string | string[] | undefined>

const NAME = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const CURSOR = /^([0-9][0-9T:. +\-Z]{9,39})~([A-Za-z0-9_-]{1,64})$/

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""
}

/** "2026-11-05" → UTC midnight, or null if it is not a real date. */
export function parseDay(s: string): Date | null {
  const m = DAY.exec(s)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null
}

/** Escapes % _ \ so user text is matched literally by LIKE. */
export function likePattern(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function encodeCursor(c: Cursor): string {
  return `${c.at}~${c.id}`
}

export function decodeCursor(s: string): Cursor | null {
  const m = CURSOR.exec(s)
  return m ? { at: m[1], id: m[2] } : null
}

/** Unknown or malformed values are dropped and reported in `invalid`; never thrown. */
export function parseFilters(params: Params): { filters: AuditFilters; invalid: boolean } {
  const filters: AuditFilters = {}
  let invalid = false

  const entity = first(params.entity)
  if (entity) NAME.test(entity) ? (filters.entity = entity) : (invalid = true)
  const action = first(params.action)
  if (action) NAME.test(action) ? (filters.action = action) : (invalid = true)
  const actor = first(params.actor)
  if (actor) filters.actor = actor.slice(0, 100)

  const from = first(params.from)
  if (from) {
    const d = parseDay(from)
    d ? (filters.from = d) : (invalid = true)
  }
  const to = first(params.to)
  if (to) {
    const d = parseDay(to)
    if (d) filters.to = new Date(d.getTime() + 86_400_000)
    else invalid = true
  }
  const cursor = first(params.cursor)
  if (cursor) {
    const c = decodeCursor(cursor)
    c ? (filters.cursor = c) : (invalid = true)
  }
  return { filters, invalid }
}
