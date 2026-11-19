import { getKysely } from "@/server/db/pool"

import { canViewCourse, isCourseStatus, type CourseStatus, type Viewer } from "../contracts/domain"
import "../db/types"

/** Read-only data access. Visibility is decided by `canViewCourse` (pure). */
export const LIST_LIMIT = 200

export type CourseRow = {
  id: string
  title: string
  summary: string | null
  description: string
  status: CourseStatus
  updatedAt: Date
}

export type LessonRow = {
  id: string
  courseId: string
  title: string
  body: string
  position: number
  meetingUrl: string | null
  startsAt: Date | null
}

type RawCourse = {
  id: string
  title: string
  summary: string | null
  description: string
  status: string
  updated_at: Date
}

const COURSE_COLS = ["id", "title", "summary", "description", "status", "updated_at"] as const

const toCourse = (r: RawCourse): CourseRow => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  description: r.description,
  status: isCourseStatus(r.status) ? r.status : "draft",
  updatedAt: r.updated_at,
})

type RawLesson = {
  id: string
  course_id: string
  title: string
  body: string
  position: number
  meeting_url: string | null
  starts_at: Date | null
}

const toLesson = (r: RawLesson): LessonRow => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  body: r.body,
  position: r.position,
  meetingUrl: r.meeting_url,
  startsAt: r.starts_at,
})

export type CourseCard = CourseRow & { total: number; done: number }

/** Published courses the person is enrolled in, with their progress. */
export async function listMyCourses(userId: string): Promise<CourseCard[]> {
  const db = getKysely()
  const rows = await db
    .selectFrom("courses_courses as c")
    .innerJoin("courses_enrollments as e", "e.course_id", "c.id")
    .select(COURSE_COLS.map((k) => `c.${k}` as const))
    .where("e.user_id", "=", userId)
    .where("c.status", "=", "published")
    .orderBy("e.enrolled_at", "desc")
    .limit(LIST_LIMIT)
    .execute()
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [totals, dones] = await Promise.all([
    db
      .selectFrom("courses_lessons")
      .select(["course_id", (eb) => eb.fn.countAll<string>().as("n")])
      .where("course_id", "in", ids)
      .groupBy("course_id")
      .execute(),
    db
      .selectFrom("courses_progress as p")
      .innerJoin("courses_lessons as l", "l.id", "p.lesson_id")
      .select(["p.course_id", (eb) => eb.fn.countAll<string>().as("n")])
      .where("p.user_id", "=", userId)
      .where("p.course_id", "in", ids)
      .groupBy("p.course_id")
      .execute(),
  ])
  const total = new Map(totals.map((t) => [t.course_id, Number(t.n)]))
  const done = new Map(dones.map((t) => [t.course_id, Number(t.n)]))
  return rows.map((r) => ({ ...toCourse(r), total: total.get(r.id) ?? 0, done: done.get(r.id) ?? 0 }))
}

/** Every course (managers), newest touched first. Caller checks `course:write`. */
export async function listAllCourses(): Promise<CourseRow[]> {
  const rows = await getKysely()
    .selectFrom("courses_courses")
    .select([...COURSE_COLS])
    .orderBy("updated_at", "desc")
    .limit(LIST_LIMIT)
    .execute()
  return rows.map(toCourse)
}

export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const row = await getKysely()
    .selectFrom("courses_enrollments")
    .select("user_id")
    .where("course_id", "=", courseId)
    .where("user_id", "=", userId)
    .executeTakeFirst()
  return !!row
}

/**
 * The course if `viewer` may see it, else null (the page answers 404: a
 * stranger cannot tell a course exists). Also says whether they are enrolled.
 */
export async function getCourseFor(
  viewer: Viewer,
  courseId: string
): Promise<{ course: CourseRow; enrolled: boolean } | null> {
  if (courseId.length === 0 || courseId.length > 100) return null
  const row = await getKysely()
    .selectFrom("courses_courses")
    .select([...COURSE_COLS])
    .where("id", "=", courseId)
    .executeTakeFirst()
  if (!row) return null
  const course = toCourse(row)
  const enrolled = await isEnrolled(viewer.userId, course.id)
  return canViewCourse(course, enrolled, viewer) ? { course, enrolled } : null
}

/** Any course by id, for the editor. Caller checks `course:write`. */
export async function getCourseForAdmin(courseId: string): Promise<CourseRow | null> {
  const row = await getKysely()
    .selectFrom("courses_courses")
    .select([...COURSE_COLS])
    .where("id", "=", courseId)
    .executeTakeFirst()
  return row ? toCourse(row) : null
}

const LESSON_COLS = ["id", "course_id", "title", "body", "position", "meeting_url", "starts_at"] as const

/** Lessons of a course in order. Call only after `getCourseFor` / a manager check. */
export async function listLessons(courseId: string): Promise<LessonRow[]> {
  const rows = await getKysely()
    .selectFrom("courses_lessons")
    .select([...LESSON_COLS])
    .where("course_id", "=", courseId)
    .orderBy("position", "asc")
    .orderBy("id", "asc")
    .execute()
  return rows.map(toLesson)
}

/** A lesson of THAT course (a lesson id of another course is "not found"). */
export async function getLesson(courseId: string, lessonId: string): Promise<LessonRow | null> {
  if (lessonId.length === 0 || lessonId.length > 100) return null
  const row = await getKysely()
    .selectFrom("courses_lessons")
    .select([...LESSON_COLS])
    .where("id", "=", lessonId)
    .where("course_id", "=", courseId)
    .executeTakeFirst()
  return row ? toLesson(row) : null
}

/** Ids of the lessons the person has seen in a course. */
export async function seenLessonIds(userId: string, courseId: string): Promise<string[]> {
  const rows = await getKysely()
    .selectFrom("courses_progress")
    .select("lesson_id")
    .where("user_id", "=", userId)
    .where("course_id", "=", courseId)
    .execute()
  return rows.map((r) => r.lesson_id)
}

export type EnrollmentRow = { userId: string; name: string | null; email: string | null; enrolledAt: Date; done: number }

/** Enrolled people of a course with how many lessons each has seen (managers). */
export async function listEnrollments(courseId: string): Promise<EnrollmentRow[]> {
  const db = getKysely()
  const rows = await db
    .selectFrom("courses_enrollments as e")
    .leftJoin("user as u", "u.id", "e.user_id")
    .select(["e.user_id", "u.name as name", "u.email as email", "e.enrolled_at"])
    .where("e.course_id", "=", courseId)
    .orderBy("e.enrolled_at", "asc")
    .limit(LIST_LIMIT)
    .execute()
  if (rows.length === 0) return []
  const dones = await db
    .selectFrom("courses_progress as p")
    .innerJoin("courses_lessons as l", "l.id", "p.lesson_id")
    .select(["p.user_id", (eb) => eb.fn.countAll<string>().as("n")])
    .where("p.course_id", "=", courseId)
    .groupBy("p.user_id")
    .execute()
  const done = new Map(dones.map((d) => [d.user_id, Number(d.n)]))
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    enrolledAt: r.enrolled_at,
    done: done.get(r.user_id) ?? 0,
  }))
}
