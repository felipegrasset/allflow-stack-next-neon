/**
 * Database side. Every function takes `db` (injected) and the already
 * resolved viewer. Kysely only. The access rules are the pure ones of
 * contracts/domain.ts.
 */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  canEnroll,
  isCourseStatus,
  planMarkSeen,
  type CourseStatus,
  type Viewer,
} from "../contracts/domain"
import type { CourseInput, LessonInput } from "../contracts/input"
import "../db/types"

type Db = Kysely<Database>

export async function saveCourseWith(
  db: Db,
  id: string | null,
  input: CourseInput,
  userId: string
): Promise<string | null> {
  const values = {
    title: input.title,
    summary: input.summary === "" ? null : input.summary,
    description: input.description,
    updated_at: new Date(),
  }
  if (id) {
    const res = await db.updateTable("courses_courses").set(values).where("id", "=", id).executeTakeFirst()
    return res.numUpdatedRows > BigInt(0) ? id : null
  }
  const newId = randomUUID()
  await db
    .insertInto("courses_courses")
    .values({ id: newId, ...values, status: "draft", created_by: userId })
    .execute()
  return newId
}

export async function setCourseStatusWith(db: Db, id: string, status: CourseStatus): Promise<boolean> {
  const res = await db
    .updateTable("courses_courses")
    .set({ status, updated_at: new Date() })
    .where("id", "=", id)
    .executeTakeFirst()
  return res.numUpdatedRows > BigInt(0)
}

export async function deleteCourseWith(db: Db, id: string): Promise<boolean> {
  const res = await db.deleteFrom("courses_courses").where("id", "=", id).executeTakeFirst()
  return res.numDeletedRows > BigInt(0)
}

/** Creates (`lessonId` null) or edits a lesson of an existing course; null when the course or the lesson is not found. */
export async function saveLessonWith(
  db: Db,
  courseId: string,
  lessonId: string | null,
  input: LessonInput
): Promise<string | null> {
  const course = await db.selectFrom("courses_courses").select("id").where("id", "=", courseId).executeTakeFirst()
  if (!course) return null
  const values = {
    title: input.title,
    body: input.body,
    position: input.position,
    meeting_url: input.meetingUrl,
    starts_at: input.startsAt,
    updated_at: new Date(),
  }
  if (lessonId) {
    const res = await db
      .updateTable("courses_lessons")
      .set(values)
      .where("id", "=", lessonId)
      .where("course_id", "=", courseId)
      .executeTakeFirst()
    return res.numUpdatedRows > BigInt(0) ? lessonId : null
  }
  const newId = randomUUID()
  await db.insertInto("courses_lessons").values({ id: newId, course_id: courseId, ...values }).execute()
  return newId
}

export async function deleteLessonWith(db: Db, courseId: string, lessonId: string): Promise<boolean> {
  const res = await db
    .deleteFrom("courses_lessons")
    .where("id", "=", lessonId)
    .where("course_id", "=", courseId)
    .executeTakeFirst()
  return res.numDeletedRows > BigInt(0)
}

export type EnrollFailure = "not_found" | "draft" | "no_user"
export type EnrollOutcome = { ok: true; created: boolean } | { ok: false; reason: EnrollFailure }

/** Enrolls a known user in a published course. Idempotent (`created: false` when already enrolled). */
export async function enrollUserWith(db: Db, courseId: string, userId: string): Promise<EnrollOutcome> {
  const course = await db
    .selectFrom("courses_courses")
    .select(["id", "status"])
    .where("id", "=", courseId)
    .executeTakeFirst()
  if (!course || !isCourseStatus(course.status)) return { ok: false, reason: "not_found" }
  if (!canEnroll({ status: course.status })) return { ok: false, reason: "draft" }
  const user = await db.selectFrom("user").select("id").where("id", "=", userId).executeTakeFirst()
  if (!user) return { ok: false, reason: "no_user" }
  const res = await db
    .insertInto("courses_enrollments")
    .values({ course_id: courseId, user_id: userId })
    .onConflict((oc) => oc.columns(["course_id", "user_id"]).doNothing())
    .executeTakeFirst()
  return { ok: true, created: (res.numInsertedOrUpdatedRows ?? BigInt(0)) > BigInt(0) }
}

export async function enrollByEmailWith(db: Db, courseId: string, email: string): Promise<EnrollOutcome> {
  const user = await db.selectFrom("user").select("id").where("email", "=", email).executeTakeFirst()
  if (!user) {
    const course = await db.selectFrom("courses_courses").select("id").where("id", "=", courseId).executeTakeFirst()
    return { ok: false, reason: course ? "no_user" : "not_found" }
  }
  return enrollUserWith(db, courseId, user.id)
}

export async function unenrollWith(db: Db, courseId: string, userId: string): Promise<boolean> {
  const res = await db
    .deleteFrom("courses_enrollments")
    .where("course_id", "=", courseId)
    .where("user_id", "=", userId)
    .executeTakeFirst()
  return res.numDeletedRows > BigInt(0)
}

export type MarkSeenOutcome = { ok: true; changed: boolean } | { ok: false; reason: "not_found" | "not_enrolled" }

/**
 * Marks a lesson as seen for the viewer. Applies the pure rules, then inserts
 * `on conflict do nothing` on (lesson_id, user_id): calling it twice, even at
 * the same time, leaves one row and answers ok both times.
 */
export async function markSeenWith(
  db: Db,
  viewer: Viewer,
  courseId: string,
  lessonId: string
): Promise<MarkSeenOutcome> {
  const course = await db
    .selectFrom("courses_courses")
    .select(["id", "status"])
    .where("id", "=", courseId)
    .executeTakeFirst()
  if (!course || !isCourseStatus(course.status)) return { ok: false, reason: "not_found" }
  const [enrollment, lesson, seen] = await Promise.all([
    db
      .selectFrom("courses_enrollments")
      .select("user_id")
      .where("course_id", "=", courseId)
      .where("user_id", "=", viewer.userId)
      .executeTakeFirst(),
    db
      .selectFrom("courses_lessons")
      .select("id")
      .where("id", "=", lessonId)
      .where("course_id", "=", courseId)
      .executeTakeFirst(),
    db
      .selectFrom("courses_progress")
      .select("lesson_id")
      .where("lesson_id", "=", lessonId)
      .where("user_id", "=", viewer.userId)
      .executeTakeFirst(),
  ])
  const plan = planMarkSeen({
    course: { status: course.status },
    enrolled: !!enrollment,
    lessonInCourse: !!lesson,
    alreadySeen: !!seen,
    viewer,
  })
  if (!plan.ok) return plan
  await db
    .insertInto("courses_progress")
    .values({ lesson_id: lessonId, user_id: viewer.userId, course_id: courseId })
    .onConflict((oc) => oc.columns(["lesson_id", "user_id"]).doNothing())
    .execute()
  return plan
}
