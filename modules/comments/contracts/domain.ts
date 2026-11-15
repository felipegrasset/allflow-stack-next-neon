/**
 * Pure rules of comments: who may delete, how mentions are found in the text,
 * which links and entity keys are acceptable. No `@/` imports, so the tests
 * run it as is.
 */

export const COMMENT_MAX = 2000
export const MENTION_CANDIDATES_MAX = 40
export const LIST_LIMIT = 200

/** Entity key of the commented record: lowercase, same shape as tickets' `entity`. */
export const ENTITY_RE = /^[a-z0-9][a-z0-9_.-]{0,62}$/
export const isEntityKey = (v: unknown): v is string => typeof v === "string" && ENTITY_RE.test(v)
export const isEntityId = (v: unknown): v is string => typeof v === "string" && v.length >= 1 && v.length <= 200

/** Only same-origin relative paths (the link of the notification); never an open redirect. */
export function isSafeHref(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length >= 1 &&
    v.length <= 500 &&
    v.startsWith("/") &&
    !v.startsWith("//") &&
    !v.includes("\\") &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(v)
  )
}

/** The person acting: their id and whether they hold `comment:delete`. */
export type Viewer = { userId: string; canDelete: boolean }

/** Delete: the author, or whoever moderates (`comment:delete`). */
export function canDeleteComment(comment: { authorId: string }, viewer: Viewer): boolean {
  return viewer.canDelete || comment.authorId === viewer.userId
}

export type Person = { id: string; name: string }

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Who `body` mentions. A mention is `@Name` (case-insensitive) where `Name` is
 * the full name of someone in `people`, with a word boundary on both sides.
 * Longest names are matched first and consumed, so "@Ana María" does not also
 * mention "Ana". Never the author. A name shared by two people is ambiguous and
 * mentions nobody (we cannot tell which one was meant). Returns ids, no repeats,
 * in order of appearance of the people list.
 */
export function findMentions(body: string, people: readonly Person[], authorId: string): string[] {
  const counts = new Map<string, number>()
  for (const p of people) counts.set(norm(p.name), (counts.get(norm(p.name)) ?? 0) + 1)
  const candidates = people
    .filter((p) => p.id !== authorId && norm(p.name).length > 0 && counts.get(norm(p.name)) === 1)
    .sort((a, b) => b.name.length - a.name.length)
  let rest = body.normalize("NFC")
  const found = new Set<string>()
  for (const p of candidates) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])@${escapeRe(p.name.normalize("NFC").trim())}(?![\\p{L}\\p{N}_])`, "iu")
    const m = re.exec(rest)
    if (!m) continue
    found.add(p.id)
    const start = m.index + m[1].length
    // Consume only this occurrence, so a shorter name inside it is not matched again.
    rest = rest.slice(0, start) + " ".repeat(m[0].length - m[1].length) + rest.slice(m.index + m[0].length)
  }
  return people.filter((p) => found.has(p.id)).map((p) => p.id)
}
