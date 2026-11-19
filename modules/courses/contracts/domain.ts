/**
 * Pure rules of courses: statuses, who sees what, who can be enrolled, what
 * marking a lesson does, progress, and the https check of a class link.
 * No `@/` imports, so the tests run it as is.
 */

export const COURSE_STATUSES = ["draft", "published"] as const
export type CourseStatus = (typeof COURSE_STATUSES)[number]

export const isCourseStatus = (v: unknown): v is CourseStatus =>
  typeof v === "string" && (COURSE_STATUSES as readonly string[]).includes(v)

/** The person looking: their id and whether they hold `course:write`. */
export type Viewer = { userId: string; canManage: boolean }

/**
 * Who may open a course (and, by extension, its lessons and files): a manager,
 * or an enrolled person while the course is published. Anyone else gets
 * "not found" (404), never "forbidden": the course is not revealed.
 */
export function canViewCourse(course: { status: CourseStatus }, enrolled: boolean, viewer: Viewer): boolean {
  return viewer.canManage || (course.status === "published" && enrolled)
}

/** A draft cannot take enrollments. */
export function canEnroll(course: { status: CourseStatus }): boolean {
  return course.status === "published"
}

export type MarkSeenPlan =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "not_found" | "not_enrolled" }

/**
 * What marking a lesson as seen does. Idempotent: an already seen lesson is
 * `ok` with `changed: false`. Progress belongs to an enrolled person only; a
 * manager previewing without being enrolled cannot mark.
 */
export function planMarkSeen(args: {
  course: { status: CourseStatus }
  enrolled: boolean
  lessonInCourse: boolean
  alreadySeen: boolean
  viewer: Viewer
}): MarkSeenPlan {
  if (!args.lessonInCourse) return { ok: false, reason: "not_found" }
  if (!canViewCourse(args.course, args.enrolled, args.viewer)) return { ok: false, reason: "not_found" }
  if (!args.enrolled || args.course.status !== "published") return { ok: false, reason: "not_enrolled" }
  return { ok: true, changed: !args.alreadySeen }
}

/** Pure model of the progress table: a set of seen lesson ids (insert-if-absent). */
export function applySeen(seen: ReadonlySet<string>, lessonId: string): Set<string> {
  return new Set([...seen, lessonId])
}

export type ProgressSummary = { done: number; total: number; percent: number }

/** Progress over the course's CURRENT lessons (a deleted lesson does not count). */
export function progressSummary(lessonIds: readonly string[], seenIds: Iterable<string>): ProgressSummary {
  const seen = new Set(seenIds)
  const total = new Set(lessonIds).size
  const done = new Set(lessonIds.filter((id) => seen.has(id))).size
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** First lesson (in course order) not yet seen; null when everything is seen or there are no lessons. */
export function nextLessonId(lessonIds: readonly string[], seenIds: Iterable<string>): string | null {
  const seen = new Set(seenIds)
  return lessonIds.find((id) => !seen.has(id)) ?? null
}

export type MeetingUrlResult = { ok: true; url: string | null } | { ok: false }

/**
 * The video-call link of a class: empty → none; otherwise an absolute https
 * URL with a dotted host, no credentials and no whitespace. http:, javascript:,
 * data: and relative links are rejected.
 */
export function parseMeetingUrl(raw: string): MeetingUrlResult {
  const value = raw.trim()
  if (value === "") return { ok: true, url: null }
  // eslint-disable-next-line no-control-regex
  if (value.length > 2000 || /[\s\u0000-\u001f\u007f\\]/.test(value)) return { ok: false }
  if (!/^https:\/\//i.test(value)) return { ok: false }
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return { ok: false }
  }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return { ok: false }
  return { ok: true, url: u.toString() }
}
