/** Pure helpers of the public search. No imports. */

/** Escapes `%`, `_` and `\` so user text is matched literally by ILIKE. */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** The ILIKE pattern for a search term (max 100 chars, whitespace collapsed). */
export function likePattern(q: string): string {
  return `%${escapeLike(normalizeQuery(q))}%`
}

export function normalizeQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim().slice(0, 100)
}

type Rankable = { title: string; summary: string | null; sortOrder: number }

/** Lower is better: title match, then summary match, then body-only match. */
export function matchRank(a: Rankable, q: string): number {
  const needle = normalizeQuery(q).toLowerCase()
  if (!needle) return 3
  if (a.title.toLowerCase().includes(needle)) return 0
  if ((a.summary ?? "").toLowerCase().includes(needle)) return 1
  return 2
}

/** Stable: rank, then the editor's order, then title. Returns a new array. */
export function rankArticles<T extends Rankable>(items: T[], q: string): T[] {
  return [...items].sort(
    (a, b) =>
      matchRank(a, q) - matchRank(b, q) ||
      a.sortOrder - b.sortOrder ||
      a.title.localeCompare(b.title)
  )
}

/** Groups by category keeping first-seen order; no category → `fallback`. */
export function groupByCategory<T extends { category: string | null }>(
  items: T[],
  fallback: string
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const key = it.category?.trim() || fallback
    const list = map.get(key)
    if (list) list.push(it)
    else map.set(key, [it])
  }
  return [...map].map(([category, list]) => ({ category, items: list }))
}
