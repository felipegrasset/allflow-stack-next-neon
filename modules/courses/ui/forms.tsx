"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useModuleCopy } from "@/modules/i18n/contracts/client"
import { FileInput } from "@/modules/storage/contracts/file-input"

import { es } from "../messages"
import {
  deleteCourseAction,
  deleteLessonAction,
  deleteLessonFileAction,
  enrollAction,
  saveCourseAction,
  saveLessonAction,
  setCourseStatusAction,
  unenrollAction,
} from "../server/actions"
import type { FormState } from "../server/state"
import { FieldRow, TEXTAREA_CLASS } from "./field-row"

const IDLE: FormState = { status: "idle" }

type Action = (prev: FormState, formData: FormData) => Promise<FormState>

function Alerts({ state }: { state: FormState }) {
  return (
    <>
      {state.status === "error" ? <FormAlert>{state.message}</FormAlert> : null}
      {state.status === "ok" ? <FormAlert variant="success">{state.message}</FormAlert> : null}
    </>
  )
}

/** A one-button form that posts hidden fields to a Server Action (publish, delete, remove…). */
function ActionForm({
  action,
  fields,
  label,
  variant = "outline",
}: {
  action: Action
  fields: Record<string, string>
  label: string
  variant?: "outline" | "destructive" | "default"
}) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, IDLE)
  return (
    <form action={formAction} className="flex flex-col gap-2" aria-busy={pending}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Alerts state={state} />
      <SubmitButton pending={pending} label={label} pendingLabel={copy.admin.working} variant={variant} className="self-start" />
    </form>
  )
}

export function PublishToggle({ courseId, published }: { courseId: string; published: boolean }) {
  const copy = useModuleCopy(es)
  return (
    <ActionForm
      action={setCourseStatusAction}
      fields={{ id: courseId, publish: published ? "no" : "yes" }}
      label={published ? copy.admin.unpublish : copy.admin.publish}
      variant={published ? "outline" : "default"}
    />
  )
}

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const copy = useModuleCopy(es)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{copy.admin.deleteWarning}</p>
      <ActionForm action={deleteCourseAction} fields={{ id: courseId }} label={copy.admin.delete} variant="destructive" />
    </div>
  )
}

export function DeleteLessonButton({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const copy = useModuleCopy(es)
  return (
    <ActionForm
      action={deleteLessonAction}
      fields={{ courseId, id: lessonId }}
      label={copy.admin.deleteLesson}
      variant="destructive"
    />
  )
}

export function RemoveFileButton({ courseId, lessonId, fileId }: { courseId: string; lessonId: string; fileId: string }) {
  const copy = useModuleCopy(es)
  return (
    <ActionForm action={deleteLessonFileAction} fields={{ courseId, lessonId, fileId }} label={copy.admin.removeFile} />
  )
}

export function UnenrollButton({ courseId, userId }: { courseId: string; userId: string }) {
  const copy = useModuleCopy(es)
  return <ActionForm action={unenrollAction} fields={{ courseId, userId }} label={copy.admin.unenroll} />
}

export type CourseFormValues = { id: string; title: string; summary: string; description: string }

/** Create (no `course`) or edit a course. Server-validated; errors come back as field errors. */
export function CourseForm({ course }: { course?: CourseFormValues }) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveCourseAction, IDLE)
  const prefix = course ? "courses-edit" : "courses-new"
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined)
  const f = copy.admin.fields
  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      aria-label={course ? copy.admin.editTitle : copy.admin.newTitle}
      aria-busy={pending}
    >
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <Alerts state={state} />
      <FieldGroup>
        <FieldRow id={`${prefix}-title`} label={f.title} error={err("title")}>
          {(aria) => <Input {...aria} name="title" defaultValue={course?.title ?? ""} maxLength={160} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-summary`} label={f.summary} description={f.summaryHint} error={err("summary")}>
          {(aria) => <Input {...aria} name="summary" defaultValue={course?.summary ?? ""} maxLength={300} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-description`} label={f.description} description={f.descriptionHint} error={err("description")}>
          {(aria) => (
            <textarea
              {...aria}
              name="description"
              rows={8}
              maxLength={20000}
              defaultValue={course?.description ?? ""}
              readOnly={pending}
              className={TEXTAREA_CLASS}
            />
          )}
        </FieldRow>
      </FieldGroup>
      <SubmitButton
        pending={pending}
        label={course ? copy.admin.save : copy.admin.create}
        pendingLabel={course ? copy.admin.saving : copy.admin.creating}
        className="self-start"
      />
    </form>
  )
}

export type LessonFormValues = {
  id: string
  title: string
  body: string
  position: number
  meetingUrl: string
  /** Value for `<input type="datetime-local">` (YYYY-MM-DDTHH:mm) or "". */
  startsAt: string
}

/** Create (no `lesson`) or edit a lesson, with an optional file to attach on save. */
export function LessonForm({
  courseId,
  lesson,
  nextPosition,
  fileCount,
}: {
  courseId: string
  lesson?: LessonFormValues
  nextPosition: number
  /** Attached files now: when it changes the file picker is reset (the previous one was attached). */
  fileCount: number
}) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveLessonAction, IDLE)
  const prefix = lesson ? "courses-lesson-edit" : "courses-lesson-new"
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined)
  const f = copy.admin.fields
  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      aria-label={lesson ? copy.admin.editLesson : copy.admin.newLesson}
      aria-busy={pending}
    >
      <input type="hidden" name="courseId" value={courseId} />
      {lesson ? <input type="hidden" name="id" value={lesson.id} /> : null}
      <Alerts state={state} />
      <FieldGroup>
        <FieldRow id={`${prefix}-title`} label={f.lessonTitle} error={err("title")}>
          {(aria) => <Input {...aria} name="title" defaultValue={lesson?.title ?? ""} maxLength={160} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-position`} label={f.position} description={f.positionHint} error={err("position")}>
          {(aria) => (
            <Input
              {...aria}
              name="position"
              type="number"
              min={0}
              max={9999}
              step={1}
              defaultValue={lesson?.position ?? nextPosition}
              readOnly={pending}
            />
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-body`} label={f.body} description={f.bodyHint} error={err("body")}>
          {(aria) => (
            <textarea
              {...aria}
              name="body"
              rows={12}
              maxLength={20000}
              defaultValue={lesson?.body ?? ""}
              readOnly={pending}
              className={TEXTAREA_CLASS}
            />
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-meeting`} label={f.meetingUrl} description={f.meetingUrlHint} error={err("meetingUrl")}>
          {(aria) => (
            <Input
              {...aria}
              name="meetingUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={lesson?.meetingUrl ?? ""}
              maxLength={2000}
              autoComplete="off"
              readOnly={pending}
            />
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-starts`} label={f.startsAt} description={f.startsAtHint} error={err("startsAt")}>
          {(aria) => <Input {...aria} name="startsAt" type="datetime-local" defaultValue={lesson?.startsAt ?? ""} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-file`} label={f.file} description={f.fileHint}>
          {(aria) => (
            <FileInput
              key={fileCount}
              name="fileId"
              id={aria.id}
              visibility="members"
              disabled={pending}
              describedBy={aria["aria-describedby"]}
            />
          )}
        </FieldRow>
      </FieldGroup>
      <SubmitButton
        pending={pending}
        label={lesson ? copy.admin.save : copy.admin.createLesson}
        pendingLabel={copy.admin.saving}
        className="self-start"
      />
    </form>
  )
}

/** Enroll a person by email (course must be published; the server re-checks). */
export function EnrollForm({ courseId, disabled }: { courseId: string; disabled: boolean }) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<FormState, FormData>(enrollAction, IDLE)
  const err = state.status === "error" ? state.fieldErrors?.email : undefined
  const f = copy.admin.fields
  return (
    <form action={formAction} className="flex flex-col gap-3" aria-label={copy.admin.enrollTitle} aria-busy={pending}>
      <input type="hidden" name="courseId" value={courseId} />
      <Alerts state={state} />
      <FieldRow id="courses-enroll-email" label={f.email} description={f.emailHint} error={err}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="off" maxLength={254} readOnly={pending} disabled={disabled} />
        )}
      </FieldRow>
      <SubmitButton
        pending={pending}
        label={copy.admin.enrollSubmit}
        pendingLabel={copy.admin.enrolling}
        disabled={disabled}
        className="self-start"
      />
    </form>
  )
}

