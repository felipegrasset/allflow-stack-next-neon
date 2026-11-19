import Link from "next/link"
import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { listFilesFor } from "@/modules/storage/contracts"

import { es } from "../messages"
import { requireCoursesViewer } from "../server/guard"
import { getCourseFor, getLesson, listLessons, seenLessonIds } from "../server/queries"
import { LESSON_FILE_ENTITY } from "../server/files"
import { asLocale } from "./format"
import { MarkSeenButton } from "./mark-seen-button"
import { RichText } from "./rich-text"

const linkClass =
  "rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * /courses/[id]/[lesson] — one lesson. The course is checked first with the
 * same rule as the course page (enrolled and published, or `course:write`),
 * and the lesson must belong to that course: anything else is 404.
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string; lesson: string }> }) {
  const { id, lesson: lessonId } = await params
  const { session, canManage } = await requireCoursesViewer(
    `/courses/${encodeURIComponent(id)}/${encodeURIComponent(lessonId)}`
  )
  const viewer = { userId: session.user.id, canManage }
  const found = await getCourseFor(viewer, id)
  if (!found) notFound()
  const { course, enrolled } = found
  const lesson = await getLesson(course.id, lessonId)
  if (!lesson) notFound()
  const [copy, locale, lessons, seen, files] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    listLessons(course.id),
    seenLessonIds(viewer.userId, course.id),
    listFilesFor(LESSON_FILE_ENTITY, lesson.id),
  ])
  const index = lessons.findIndex((l) => l.id === lesson.id)
  const prev = index > 0 ? lessons[index - 1] : null
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null
  const isSeen = seen.includes(lesson.id)

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/courses/${course.id}`} className={linkClass}>
        {copy.lesson.back}: {course.title}
      </Link>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{copy.lesson.position(index + 1, lessons.length)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{lesson.title}</h1>
          {enrolled && isSeen ? <Badge variant="secondary">{copy.lesson.seen}</Badge> : null}
        </div>
        {!enrolled ? <p className="text-sm text-muted-foreground">{copy.lesson.previewNote}</p> : null}
      </div>

      {lesson.meetingUrl ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border p-4" aria-labelledby="courses-live">
          <h2 id="courses-live" className="text-base font-medium">
            {copy.lesson.liveTitle}
          </h2>
          {lesson.startsAt ? (
            <p className="text-sm text-muted-foreground">{copy.lesson.startsAt(formatDateTime(lesson.startsAt, locale))}</p>
          ) : null}
          <ButtonLink
            href={lesson.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            className="self-start"
          >
            {copy.lesson.joinCall}
          </ButtonLink>
        </section>
      ) : null}

      {lesson.body ? <RichText body={lesson.body} /> : <p className="text-sm text-muted-foreground">{copy.lesson.noBody}</p>}

      {files.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="courses-files">
          <h2 id="courses-files" className="text-base font-medium">
            {copy.lesson.attachments}
          </h2>
          <ul className="flex flex-col gap-1">
            {files.map((f) => (
              <li key={f.id}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {enrolled && course.status === "published" && !isSeen ? <MarkSeenButton courseId={course.id} lessonId={lesson.id} /> : null}

      <nav className="flex flex-wrap justify-between gap-2" aria-label={copy.course.lessonsTitle}>
        {prev ? (
          <ButtonLink href={`/courses/${course.id}/${prev.id}`} variant="outline" size="sm">
            {copy.lesson.prev}
          </ButtonLink>
        ) : (
          <span />
        )}
        {next ? (
          <ButtonLink href={`/courses/${course.id}/${next.id}`} variant="outline" size="sm">
            {copy.lesson.next}
          </ButtonLink>
        ) : null}
      </nav>
    </div>
  )
}
