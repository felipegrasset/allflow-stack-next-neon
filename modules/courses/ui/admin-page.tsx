import Link from "next/link"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { listFilesFor } from "@/modules/storage/contracts"

import { es } from "../messages"
import { requirePagePermission } from "../server/guard"
import { LESSON_FILE_ENTITY } from "../server/files"
import { getCourseForAdmin, listAllCourses, listEnrollments, listLessons } from "../server/queries"
import {
  CourseForm,
  DeleteCourseButton,
  DeleteLessonButton,
  EnrollForm,
  LessonForm,
  PublishToggle,
  RemoveFileButton,
  UnenrollButton,
} from "./forms"
import { asLocale } from "./format"

type SearchParams = Promise<{
  id?: string | string[]
  lesson?: string | string[]
  new?: string | string[]
  newLesson?: string | string[]
}>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const linkClass = "text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/** Value for `<input type="datetime-local">` in UTC (the server time zone is read back the same way). */
function toLocalInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16) : ""
}

/**
 * /admin/courses — the editor. Needs `course:write`. `?id=<id>` edits a course
 * (`&lesson=<id>` or `&newLesson=1` for a lesson), `?new=1` creates one.
 */
export default async function CoursesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("/admin/courses", "write")
  const sp = await searchParams
  const id = one(sp.id).slice(0, 100)
  const lessonParam = one(sp.lesson).slice(0, 100)
  const creating = one(sp.new) === "1"
  const newLesson = one(sp.newLesson) === "1"
  const [copy, locale] = await Promise.all([getModuleCopy(es), getLocale().then(asLocale)])
  const [rows, selected] = await Promise.all([listAllCourses(), id ? getCourseForAdmin(id) : Promise.resolve(null)])
  const [lessons, enrollments] = selected
    ? await Promise.all([listLessons(selected.id), listEnrollments(selected.id)])
    : [[], []]
  const lesson = lessonParam ? (lessons.find((l) => l.id === lessonParam) ?? null) : null
  const lessonFiles = lesson ? await listFilesFor(LESSON_FILE_ENTITY, lesson.id) : []
  const nextPosition = lessons.length === 0 ? 1 : Math.min(9999, Math.max(...lessons.map((l) => l.position)) + 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.admin.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/courses" variant="outline" size="sm">
            {copy.admin.back}
          </ButtonLink>
          <ButtonLink href="/admin/courses?new=1" size="sm">
            {copy.admin.newLink}
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3" aria-labelledby="courses-list">
          <h2 id="courses-list" className="text-base font-medium">
            {copy.admin.listTitle}
          </h2>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {copy.admin.empty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/courses?id=${encodeURIComponent(c.id)}`}
                    aria-current={c.id === selected?.id ? "true" : undefined}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
                  >
                    <span className="text-sm font-medium">{c.title}</span>
                    <Badge variant={c.status === "published" ? "secondary" : "outline"}>{copy.statuses[c.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-8">
          {selected ? (
            <>
              <section className="flex flex-col gap-4" aria-labelledby="courses-edit">
                <h2 id="courses-edit" className="text-base font-medium">
                  {copy.admin.editTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={selected.status === "published" ? "secondary" : "outline"}>
                    {copy.statuses[selected.status]}
                  </Badge>
                  <Link href={`/courses/${encodeURIComponent(selected.id)}`} className={linkClass}>
                    {copy.admin.viewAsStudent}
                  </Link>
                </div>
                <CourseForm
                  key={selected.id}
                  course={{
                    id: selected.id,
                    title: selected.title,
                    summary: selected.summary ?? "",
                    description: selected.description,
                  }}
                />
                <PublishToggle courseId={selected.id} published={selected.status === "published"} />
                <DeleteCourseButton courseId={selected.id} />
              </section>

              <section className="flex flex-col gap-3" aria-labelledby="courses-lessons-admin">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="courses-lessons-admin" className="text-base font-medium">
                    {copy.admin.lessonsTitle}
                  </h2>
                  <ButtonLink
                    href={`/admin/courses?id=${encodeURIComponent(selected.id)}&newLesson=1`}
                    variant="outline"
                    size="sm"
                  >
                    {copy.admin.newLesson}
                  </ButtonLink>
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {copy.admin.lessonsCount(lessons.length)}
                </p>
                {lessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.admin.lessonsEmpty}</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/admin/courses?id=${encodeURIComponent(selected.id)}&lesson=${encodeURIComponent(l.id)}`}
                          aria-current={l.id === lesson?.id ? "true" : undefined}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
                        >
                          <span className="font-medium">
                            {l.position}. {l.title}
                          </span>
                          {l.meetingUrl ? <Badge variant="outline">{copy.course.live}</Badge> : null}
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}

                {lesson ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
                    <h3 className="text-sm font-medium">{copy.admin.editLesson}</h3>
                    <LessonForm
                      key={lesson.id}
                      courseId={selected.id}
                      nextPosition={nextPosition}
                      fileCount={lessonFiles.length}
                      lesson={{
                        id: lesson.id,
                        title: lesson.title,
                        body: lesson.body,
                        position: lesson.position,
                        meetingUrl: lesson.meetingUrl ?? "",
                        startsAt: toLocalInput(lesson.startsAt),
                      }}
                    />
                    <section className="flex flex-col gap-2" aria-labelledby="courses-lesson-files">
                      <h4 id="courses-lesson-files" className="text-sm font-medium">
                        {copy.admin.filesTitle}
                      </h4>
                      {lessonFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{copy.admin.filesEmpty}</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {lessonFiles.map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                {f.name}
                              </a>
                              <RemoveFileButton courseId={selected.id} lessonId={lesson.id} fileId={f.id} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    <DeleteLessonButton courseId={selected.id} lessonId={lesson.id} />
                  </div>
                ) : newLesson ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
                    <h3 className="text-sm font-medium">{copy.admin.newLesson}</h3>
                    <LessonForm courseId={selected.id} nextPosition={nextPosition} fileCount={0} />
                  </div>
                ) : null}
              </section>

              <section className="flex flex-col gap-3" aria-labelledby="courses-enroll">
                <h2 id="courses-enroll" className="text-base font-medium">
                  {copy.admin.enrollTitle}
                </h2>
                {selected.status === "draft" ? (
                  <p className="text-sm text-muted-foreground">{copy.admin.enrollDraftHint}</p>
                ) : null}
                <EnrollForm courseId={selected.id} disabled={selected.status !== "published"} />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {copy.admin.enrollCount(enrollments.length)}
                </p>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.admin.enrollEmpty}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {enrollments.map((e) => (
                      <li key={e.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{e.name ?? copy.admin.unknownUser}</span>
                          <span className="text-xs text-muted-foreground">
                            {e.email ? `${e.email} · ` : ""}
                            {copy.admin.enrolledProgress(e.done)} · {formatDateTime(e.enrolledAt, locale)}
                          </span>
                        </div>
                        <UnenrollButton courseId={selected.id} userId={e.userId} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : creating || rows.length === 0 ? (
            <section className="flex flex-col gap-4" aria-labelledby="courses-new">
              <h2 id="courses-new" className="text-base font-medium">
                {copy.admin.newTitle}
              </h2>
              <CourseForm />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
