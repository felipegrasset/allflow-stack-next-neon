/**
 * courses v0.1 — what runs without a database: who sees which course (404 for
 * strangers and drafts), enrollment rules, idempotent progress, the https check
 * of a class link, the Zod schemas, the safe markdown, the catalog, the manifest,
 * permissions and, reading the code, the guards of the Server Actions and the
 * queries. Relative imports only, so it runs transpiled without the `@/` alias.
 * Run from the repo root (the source checks read `modules/courses/**`).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  COURSE_STATUSES,
  applySeen,
  canEnroll,
  canViewCourse,
  nextLessonId,
  parseMeetingUrl,
  planMarkSeen,
  progressSummary,
  type CourseStatus,
  type Viewer,
} from "../contracts/domain"
import { courseSchemas } from "../contracts/input"
import { parseBody, safeHref } from "../contracts/markdown"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(process.cwd(), "modules", "courses")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

const student: Viewer = { userId: "u-student", canManage: false }
const manager: Viewer = { userId: "u-manager", canManage: true }
const published = { status: "published" as CourseStatus }
const draft = { status: "draft" as CourseStatus }

// ── visibility ───────────────────────────────────────────────────────────────

test("canViewCourse: only enrolled people see a published course", () => {
  assert.equal(canViewCourse(published, true, student), true)
  assert.equal(canViewCourse(published, false, student), false) // a stranger gets 404
})

test("canViewCourse: a draft is invisible to students, even enrolled ones", () => {
  assert.equal(canViewCourse(draft, true, student), false)
  assert.equal(canViewCourse(draft, false, student), false)
})

test("canViewCourse: course:write sees everything", () => {
  for (const status of COURSE_STATUSES)
    for (const enrolled of [true, false]) assert.equal(canViewCourse({ status }, enrolled, manager), true)
})

test("canEnroll: published only", () => {
  assert.equal(canEnroll(published), true)
  assert.equal(canEnroll(draft), false)
})

// ── progress ─────────────────────────────────────────────────────────────────

test("planMarkSeen: enrolled person on a published course; a repeat is ok and unchanged", () => {
  const base = { course: published, enrolled: true, lessonInCourse: true, viewer: student }
  assert.deepEqual(planMarkSeen({ ...base, alreadySeen: false }), { ok: true, changed: true })
  assert.deepEqual(planMarkSeen({ ...base, alreadySeen: true }), { ok: true, changed: false })
})

test("planMarkSeen: a lesson of another course, a stranger or a draft are not found", () => {
  const base = { course: published, enrolled: true, lessonInCourse: true, alreadySeen: false, viewer: student }
  assert.deepEqual(planMarkSeen({ ...base, lessonInCourse: false }), { ok: false, reason: "not_found" })
  assert.deepEqual(planMarkSeen({ ...base, enrolled: false }), { ok: false, reason: "not_found" })
  assert.deepEqual(planMarkSeen({ ...base, course: draft }), { ok: false, reason: "not_found" })
})

test("planMarkSeen: a manager who is not enrolled can look but not record progress", () => {
  const res = planMarkSeen({
    course: published,
    enrolled: false,
    lessonInCourse: true,
    alreadySeen: false,
    viewer: manager,
  })
  assert.deepEqual(res, { ok: false, reason: "not_enrolled" })
})

test("applySeen is idempotent and does not mutate its input", () => {
  const start = new Set(["l1"])
  const once = applySeen(start, "l2")
  const twice = applySeen(once, "l2")
  assert.deepEqual([...once].sort(), ["l1", "l2"])
  assert.deepEqual([...twice].sort(), [...once].sort())
  assert.deepEqual([...start], ["l1"])
})

test("progress is per person: one person's seen set does not touch another's", () => {
  const lessons = ["l1", "l2", "l3"]
  const ana = applySeen(new Set<string>(), "l1")
  const luis = new Set<string>()
  assert.deepEqual(progressSummary(lessons, ana), { done: 1, total: 3, percent: 33 })
  assert.deepEqual(progressSummary(lessons, luis), { done: 0, total: 3, percent: 0 })
})

test("progressSummary: ignores deleted lessons, handles empty courses", () => {
  assert.deepEqual(progressSummary(["a", "b"], ["a", "gone"]), { done: 1, total: 2, percent: 50 })
  assert.deepEqual(progressSummary([], ["a"]), { done: 0, total: 0, percent: 0 })
  assert.deepEqual(progressSummary(["a"], ["a"]), { done: 1, total: 1, percent: 100 })
})

test("nextLessonId: first unseen in course order", () => {
  assert.equal(nextLessonId(["a", "b", "c"], ["a", "c"]), "b")
  assert.equal(nextLessonId(["a"], ["a"]), null)
  assert.equal(nextLessonId([], []), null)
})

// ── video-call link ──────────────────────────────────────────────────────────

test("parseMeetingUrl: https only; empty means no link", () => {
  assert.deepEqual(parseMeetingUrl(""), { ok: true, url: null })
  assert.deepEqual(parseMeetingUrl("   "), { ok: true, url: null })
  const ok = parseMeetingUrl("https://meet.example.com/sala-1")
  assert.deepEqual(ok, { ok: true, url: "https://meet.example.com/sala-1" })
  assert.equal(parseMeetingUrl("HTTPS://Meet.Example.com/x").ok, true)
  for (const bad of [
    "http://meet.example.com/x",
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "ftp://meet.example.com",
    "//meet.example.com/x",
    "/sala",
    "meet.example.com/x",
    "https://",
    "https://localhost/x",
    "https://user:pass@meet.example.com/x",
    "https://meet.example .com/x",
    "https://meet.example.com/\nx",
    "https://meet.example.com\\evil.example",
    "https://" + "a".repeat(2000) + ".com",
  ])
    assert.equal(parseMeetingUrl(bad).ok, false, JSON.stringify(bad))
})

// ── schemas ──────────────────────────────────────────────────────────────────

test("lessonSchema: title required, position range, https link and date normalised", () => {
  const { lessonSchema } = courseSchemas({ required: "REQ", invalidUrl: "URL", invalidDate: "DATE" })
  const good = lessonSchema.safeParse({
    title: " Clase 1 ",
    body: "Hola",
    position: 3,
    meetingUrl: "https://meet.example.com/a",
    startsAt: "2026-12-01T18:30",
  })
  assert.ok(good.success)
  assert.equal(good.data.title, "Clase 1")
  assert.equal(good.data.meetingUrl, "https://meet.example.com/a")
  assert.ok(good.data.startsAt instanceof Date)

  const empty = lessonSchema.safeParse({ title: "x", body: "", position: 0, meetingUrl: "", startsAt: "" })
  assert.ok(empty.success && empty.data.meetingUrl === null && empty.data.startsAt === null)

  const bad = lessonSchema.safeParse({
    title: "",
    body: "",
    position: -1,
    meetingUrl: "http://insecure.example.com",
    startsAt: "no es fecha",
  })
  assert.ok(!bad.success)
  const byKey = new Map(bad.error.issues.map((i) => [String(i.path[0]), i.message]))
  assert.equal(byKey.get("title"), "REQ")
  assert.equal(byKey.get("meetingUrl"), "URL")
  assert.equal(byKey.get("startsAt"), "DATE")
  assert.ok(byKey.has("position"))
  assert.equal(lessonSchema.safeParse({ title: "x", body: "", position: Number.NaN, meetingUrl: "", startsAt: "" }).success, false)
})

test("courseSchema, enrollSchema and idSchema", () => {
  const { courseSchema, enrollSchema, idSchema } = courseSchemas()
  assert.equal(courseSchema.safeParse({ title: "", summary: "", description: "" }).success, false)
  assert.equal(courseSchema.safeParse({ title: "Curso", summary: "x".repeat(301), description: "" }).success, false)
  assert.equal(courseSchema.safeParse({ title: "Curso", summary: "", description: "" }).success, true)
  const e = enrollSchema.safeParse({ email: "  Ana@Example.COM " })
  assert.ok(e.success && e.data.email === "ana@example.com")
  assert.equal(enrollSchema.safeParse({ email: "no-es-correo" }).success, false)
  assert.equal(idSchema.safeParse({ id: "" }).success, false)
  assert.equal(idSchema.safeParse({ id: "x".repeat(101) }).success, false)
})

// ── markdown ─────────────────────────────────────────────────────────────────

test("markdown: raw HTML stays text and dangerous links lose their href", () => {
  const blocks = parseBody("<script>alert(1)</script>\n\n[x](javascript:alert(1))")
  assert.ok(blocks[0].type === "paragraph")
  assert.deepEqual(blocks[0].children, [{ type: "text", text: "<script>alert(1)</script>" }])
  assert.equal(safeHref("javascript:alert(1)"), null)
  assert.equal(safeHref("data:text/html;base64,AAAA"), null)
  assert.equal(safeHref("https://example.com")?.external, true)
  assert.doesNotMatch(read("ui/rich-text.tsx"), /dangerouslySetInnerHTML/)
})

// ── catalog, permissions, manifest ───────────────────────────────────────────

test("messages: es and en have the same keys and the same ICU arguments", () => {
  const leaves = (o: unknown, p = ""): [string, string][] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "string" ? [[p + k, v] as [string, string]] : leaves(v, `${p}${k}.`)
    )
  const args = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join(",")
  const a = leaves(es)
  const b = new Map(leaves(en))
  assert.deepEqual(a.map(([k]) => k).sort(), [...b.keys()].sort())
  for (const [k, v] of a) {
    assert.ok(v.length > 0 && b.get(k)!.length > 0, k)
    assert.equal(args(v), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["courses"])
  for (const s of COURSE_STATUSES) assert.ok(s in es.courses.statuses, s)
})

test("permissions: member reads; write opens /admin", () => {
  assert.deepEqual(permissions.statement, { course: ["read", "write"] })
  assert.deepEqual(permissions.grants.member, { course: ["read"] })
  assert.deepEqual(permissions.adminAccess, { course: ["write"] })
})

test("nav: the editor is an admin-area link guarded by course:write", () => {
  const src = read("nav.ts")
  assert.match(src, /href: "\/admin\/courses"[^}]*area: "admin"[^}]*permission: \{ course: \["write"\] \}/)
})

test("manifest: tables, migration, routes and entrypoints match the files", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "courses")
  assert.deepEqual(m.dependsOn, ["storage"])
  assert.deepEqual(m.migrations, ["0123_courses_init"])
  const sql = read("db/migrations/0123_courses_init.ts")
  for (const table of m.tables) assert.match(sql, new RegExp(`create table ${table} \\(`), table)
  for (const r of m.routes) assert.doesNotThrow(() => read(r.entry), r.entry)
  for (const f of Object.values(m.entrypoints) as string[]) assert.doesNotThrow(() => read(f), f)
  assert.deepEqual(
    m.routes.map((r: { path: string }) => r.path),
    ["/courses", "/courses/[id]", "/courses/[id]/[lesson]", "/admin/courses"]
  )
})

test("migration: no foreign key on user ids; lessons, enrollments and progress cascade; https check", () => {
  const sql = read("db/migrations/0123_courses_init.ts")
  assert.doesNotMatch(sql, /references "user"/)
  assert.equal((sql.match(/references courses_courses\(id\) on delete cascade/g) ?? []).length, 3)
  assert.match(sql, /references courses_lessons\(id\) on delete cascade/)
  assert.match(sql, /primary key \(lesson_id, user_id\)/)
  assert.match(sql, /like 'https:\/\/%'/)
})

// ── source checks (what cannot run here) ─────────────────────────────────────

test("every management Server Action checks session + permission before writing", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const parts = src.split(/export async function /).slice(1)
  assert.equal(parts.length, 9)
  for (const p of parts) {
    assert.match(p, /safeParse\(|idOk\(/)
    const isStudent = p.startsWith("markSeenAction")
    const guard = p.indexOf(isStudent ? "viewerSession(" : 'actionSession("/admin/courses", "write")')
    const write = p.search(/(\w+With|attachFile|deleteFile)\(/)
    assert.ok(guard > -1 && write > guard, p.slice(0, 40))
  }
  assert.doesNotMatch(src, /^export const /m) // a "use server" file exports only async functions
})

test("progress insert is idempotent (on conflict do nothing) and re-applies the pure rules", () => {
  const store = read("server/store.ts")
  assert.match(store, /planMarkSeen\(/)
  assert.match(store, /insertInto\("courses_progress"\)[\s\S]*?doNothing\(\)/)
  assert.match(store, /canEnroll\(/)
  assert.doesNotMatch(store, /sql`/)
})

test("student pages answer 404 through getCourseFor; lessons must belong to the course", () => {
  for (const f of ["ui/course-page.tsx", "ui/lesson-page.tsx"]) {
    const src = read(f)
    assert.match(src, /getCourseFor\(/, f)
    assert.match(src, /notFound\(\)/, f)
    assert.doesNotMatch(src, /forbidden\(/, f)
  }
  assert.match(read("ui/lesson-page.tsx"), /getLesson\(course\.id, lessonId\)/)
  const q = read("server/queries.ts")
  assert.match(q, /canViewCourse\(/)
  assert.match(q, /\.where\("course_id", "=", courseId\)/)
  assert.match(q, /\.where\("c\.status", "=", "published"\)/)
  assert.match(read("ui/admin-page.tsx"), /requirePagePermission\([^)]*"write"\)/)
})

test("lessons attach files through storage contracts only", () => {
  for (const f of ["server/actions.ts", "ui/lesson-page.tsx", "ui/admin-page.tsx", "ui/forms.tsx"]) {
    const imports = [...read(f).matchAll(/from "(@\/modules\/[^"]+)"/g)].map((m) => m[1])
    for (const i of imports) assert.match(i, /^@\/modules\/(storage\/contracts(\/file-input)?|i18n\/contracts(\/server|\/client)?)$/, `${f}: ${i}`)
  }
  assert.match(read("server/actions.ts"), /visibility: "members"/)
  assert.match(read("ui/lesson-page.tsx"), /rel="noopener noreferrer"/)
})

test("no literal colors in the UI", () => {
  for (const f of ["ui/page.tsx", "ui/course-page.tsx", "ui/lesson-page.tsx", "ui/admin-page.tsx", "ui/forms.tsx", "ui/mark-seen-button.tsx"])
    assert.doesNotMatch(read(f), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/, f)
})
