"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { z } from "zod"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { attachFile, deleteFile, listFilesFor } from "@/modules/storage/contracts"
import { getKysely } from "@/server/db/pool"

import { courseSchemas } from "../contracts/input"
import { es } from "../messages"
import { LESSON_FILE_ENTITY } from "./files"
import { actionSession, viewerSession } from "./guard"
import type { FormState } from "./state"
import {
  deleteCourseWith,
  deleteLessonWith,
  enrollByEmailWith,
  markSeenWith,
  saveCourseWith,
  saveLessonWith,
  setCourseStatusWith,
  unenrollWith,
} from "./store"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and permission BEFORE touching data, (2) validates again with Zod,
 * (3) only then writes. Managing needs `course:write`; marking a lesson as
 * seen needs `course:read` (or write) and is re-checked against enrollment.
 */

function fieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out)) out[key] = issue.message
  }
  return out
}

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "")
const idOk = (id: string) => id.length > 0 && id.length <= 100

function revalidateAll(courseId?: string, lessonId?: string) {
  revalidatePath("/admin/courses")
  revalidatePath("/courses")
  if (courseId) revalidatePath(`/courses/${courseId}`)
  if (courseId && lessonId) revalidatePath(`/courses/${courseId}/${lessonId}`)
}

/** Deletes the files attached to a lesson (best effort: the row delete matters more). */
async function purgeLessonFiles(lessonId: string): Promise<void> {
  try {
    for (const f of await listFilesFor(LESSON_FILE_ENTITY, lessonId)) await deleteFile(f.id)
  } catch (err) {
    console.error("[courses] purging lesson files failed", err)
  }
}

export async function saveCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const { courseSchema } = courseSchemas(copy.validation)
  const rawId = str(formData.get("id"))
  if (rawId !== "" && !idOk(rawId)) return { status: "error", message: copy.errors.notFound }
  const parsed = courseSchema.safeParse({
    title: str(formData.get("title")),
    summary: str(formData.get("summary")),
    description: str(formData.get("description")),
  })
  if (!parsed.success)
    return { status: "error", message: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  let newId: string | null = null
  try {
    const id = await saveCourseWith(getKysely(), rawId === "" ? null : rawId, parsed.data, session.user.id)
    if (!id) return { status: "error", message: copy.errors.notFound }
    if (rawId === "") newId = id
  } catch (err) {
    console.error("[courses] saveCourseAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(rawId || undefined)
  if (newId) redirect(`/admin/courses?id=${encodeURIComponent(newId)}`)
  return { status: "ok", message: copy.admin.saved }
}

export async function setCourseStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const id = str(formData.get("id"))
  if (!idOk(id)) return { status: "error", message: copy.errors.notFound }
  const publish = formData.get("publish") === "yes"
  try {
    const found = await setCourseStatusWith(getKysely(), id, publish ? "published" : "draft")
    if (!found) return { status: "error", message: copy.errors.notFound }
  } catch (err) {
    console.error("[courses] setCourseStatusAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(id)
  return { status: "ok", message: publish ? copy.admin.publishedNow : copy.admin.unpublishedNow }
}

export async function deleteCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const id = str(formData.get("id"))
  if (!idOk(id)) return { status: "error", message: copy.errors.notFound }
  try {
    const db = getKysely()
    const lessons = await db.selectFrom("courses_lessons").select("id").where("course_id", "=", id).execute()
    const found = await deleteCourseWith(db, id)
    if (!found) return { status: "error", message: copy.errors.notFound }
    for (const l of lessons) await purgeLessonFiles(l.id)
  } catch (err) {
    console.error("[courses] deleteCourseAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(id)
  redirect("/admin/courses")
}

export async function saveLessonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const { lessonSchema } = courseSchemas(copy.validation)
  const courseId = str(formData.get("courseId"))
  const rawId = str(formData.get("id"))
  if (!idOk(courseId) || (rawId !== "" && !idOk(rawId))) return { status: "error", message: copy.errors.notFound }
  const parsed = lessonSchema.safeParse({
    title: str(formData.get("title")),
    body: str(formData.get("body")),
    position: Number(str(formData.get("position")) || "0"),
    meetingUrl: str(formData.get("meetingUrl")),
    startsAt: str(formData.get("startsAt")),
  })
  if (!parsed.success)
    return { status: "error", message: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  const fileId = str(formData.get("fileId"))
  let lessonId: string | null
  try {
    lessonId = await saveLessonWith(getKysely(), courseId, rawId === "" ? null : rawId, parsed.data)
    if (!lessonId) return { status: "error", message: copy.errors.notFound }
    if (fileId !== "" && idOk(fileId)) {
      // `members`: students open it through /api/storage/<id> (any signed-in member with file:read).
      const file = await attachFile({
        fileId,
        ownerId: session.user.id,
        entity: LESSON_FILE_ENTITY,
        entityId: lessonId,
        visibility: "members",
      })
      if (!file) return { status: "error", message: copy.errors.attachFailed }
    }
  } catch (err) {
    console.error("[courses] saveLessonAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(courseId, lessonId)
  if (rawId === "") redirect(`/admin/courses?id=${encodeURIComponent(courseId)}&lesson=${encodeURIComponent(lessonId)}`)
  return { status: "ok", message: copy.admin.saved }
}

export async function deleteLessonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const courseId = str(formData.get("courseId"))
  const id = str(formData.get("id"))
  if (!idOk(courseId) || !idOk(id)) return { status: "error", message: copy.errors.notFound }
  try {
    const found = await deleteLessonWith(getKysely(), courseId, id)
    if (!found) return { status: "error", message: copy.errors.notFound }
    await purgeLessonFiles(id)
  } catch (err) {
    console.error("[courses] deleteLessonAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(courseId, id)
  redirect(`/admin/courses?id=${encodeURIComponent(courseId)}`)
}

/** Removes ONE attachment of a lesson (it must really belong to that lesson). */
export async function deleteLessonFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const courseId = str(formData.get("courseId"))
  const lessonId = str(formData.get("lessonId"))
  const fileId = str(formData.get("fileId"))
  if (!idOk(courseId) || !idOk(lessonId) || !idOk(fileId)) return { status: "error", message: copy.errors.notFound }
  try {
    const lesson = await getKysely()
      .selectFrom("courses_lessons")
      .select("id")
      .where("id", "=", lessonId)
      .where("course_id", "=", courseId)
      .executeTakeFirst()
    if (!lesson) return { status: "error", message: copy.errors.notFound }
    const files = await listFilesFor(LESSON_FILE_ENTITY, lessonId)
    if (!files.some((f) => f.id === fileId)) return { status: "error", message: copy.errors.notFound }
    await deleteFile(fileId)
  } catch (err) {
    console.error("[courses] deleteLessonFileAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(courseId, lessonId)
  return { status: "ok", message: copy.admin.fileRemoved }
}

export async function enrollAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const { enrollSchema } = courseSchemas(copy.validation)
  const courseId = str(formData.get("courseId"))
  if (!idOk(courseId)) return { status: "error", message: copy.errors.notFound }
  const parsed = enrollSchema.safeParse({ email: str(formData.get("email")) })
  if (!parsed.success)
    return { status: "error", message: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const res = await enrollByEmailWith(getKysely(), courseId, parsed.data.email)
    if (!res.ok) {
      if (res.reason === "draft") return { status: "error", message: copy.errors.draftNoEnroll }
      if (res.reason === "no_user")
        return { status: "error", message: copy.errors.invalid, fieldErrors: { email: copy.errors.noUser } }
      return { status: "error", message: copy.errors.notFound }
    }
    revalidateAll(courseId)
    return { status: "ok", message: res.created ? copy.admin.enrolled : copy.admin.alreadyEnrolled }
  } catch (err) {
    console.error("[courses] enrollAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
}

export async function unenrollAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await actionSession("/admin/courses", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const courseId = str(formData.get("courseId"))
  const userId = str(formData.get("userId"))
  if (!idOk(courseId) || !idOk(userId)) return { status: "error", message: copy.errors.notFound }
  try {
    const found = await unenrollWith(getKysely(), courseId, userId)
    if (!found) return { status: "error", message: copy.errors.notFound }
  } catch (err) {
    console.error("[courses] unenrollAction failed", err)
    return { status: "error", message: copy.errors.generic }
  }
  revalidateAll(courseId)
  return { status: "ok", message: copy.admin.unenrolled }
}

export type MarkSeenResult = { ok: true } | { ok: false; error: string }

/** Marks a lesson as seen for the signed-in person. Idempotent; a course or lesson they cannot see answers "not found". */
export async function markSeenAction(courseId: string, lessonId: string): Promise<MarkSeenResult> {
  const who = await viewerSession(`/courses/${encodeURIComponent(String(courseId).slice(0, 100))}`)
  const copy = await getModuleCopy(es)
  if (!who) return { ok: false, error: copy.errors.forbidden }
  if (typeof courseId !== "string" || typeof lessonId !== "string" || !idOk(courseId) || !idOk(lessonId))
    return { ok: false, error: copy.errors.notFound }
  try {
    const res = await markSeenWith(
      getKysely(),
      { userId: who.session.user.id, canManage: who.canManage },
      courseId,
      lessonId
    )
    if (!res.ok) return { ok: false, error: res.reason === "not_enrolled" ? copy.errors.notEnrolled : copy.errors.notFound }
    revalidateAll(courseId, lessonId)
    return { ok: true }
  } catch (err) {
    console.error("[courses] markSeenAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
}
