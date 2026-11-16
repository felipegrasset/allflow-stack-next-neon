import Link from "next/link"
import { notFound } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { nextLessonId, progressSummary } from "../contracts/domain"
import { es } from "../messages"
import { requireCoursesViewer } from "../server/guard"
import { getCourseFor, listLessons, seenLessonIds } from "../server/queries"
import { RichText } from "./rich-text"

const linkClass =
  "rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/** /courses/[id] — a course and its lessons. Not enrolled (or draft) and no `course:write` → 404, never 403. */
export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, canManage } = await requireCoursesViewer(`/courses/${encodeURIComponent(id)}`)
  const viewer = { userId: session.user.id, canManage }
  const found = await getCourseFor(viewer, id)
  if (!found) notFound()
  const { course, enrolled } = found
  const [copy, lessons, seen] = await Promise.all([
    getModuleCopy(es),
    listLessons(course.id),
    seenLessonIds(viewer.userId, course.id),
  ])
  const ids = lessons.map((l) => l.id)
  const progress = progressSummary(ids, seen)
  const seenSet = new Set(seen)
  const next = nextLessonId(ids, seen)
  const fromAdmin = canManage && !enrolled

  return (
    <div className="flex flex-col gap-6">
      <Link href={fromAdmin ? "/admin/courses" : "/courses"} className={linkClass}>
        {fromAdmin ? copy.course.backAdmin : copy.course.back}
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{course.title}</h1>
          {course.status === "draft" ? <Badge variant="outline">{copy.statuses.draft}</Badge> : null}
        </div>
        {course.summary ? <p className="text-sm text-muted-foreground">{course.summary}</p> : null}
        {course.status === "draft" ? <p className="text-sm text-muted-foreground">{copy.course.draftNote}</p> : null}
        {!enrolled ? <p className="text-sm text-muted-foreground">{copy.course.previewNote}</p> : null}
        {canManage ? (
          <Link href={`/admin/courses?id=${encodeURIComponent(course.id)}`} className={linkClass}>
            {copy.course.manage}
          </Link>
        ) : null}
      </div>

      {course.description ? <RichText body={course.description} /> : null}

      <section className="flex flex-col gap-3" aria-labelledby="courses-lessons">
        <h2 id="courses-lessons" className="text-base font-medium">
          {copy.course.lessonsTitle}
        </h2>
        {lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.course.noLessons}</p>
        ) : (
          <>
            {enrolled ? (
              <div className="flex flex-col gap-2">
                <progress
                  value={progress.done}
                  max={progress.total}
                  aria-label={copy.course.progress(progress.done, progress.total, progress.percent)}
                  className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {copy.course.progress(progress.done, progress.total, progress.percent)}
                </p>
                {next ? (
                  <ButtonLink href={`/courses/${course.id}/${next}`} size="sm" className="self-start">
                    {progress.done === 0 ? copy.course.start : copy.course.continue}
                  </ButtonLink>
                ) : (
                  <p className="text-sm font-medium">{copy.course.allDone}</p>
                )}
              </div>
            ) : null}
            <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={`/courses/${course.id}/${l.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="text-sm font-medium">
                      {i + 1}. {l.title}
                    </span>
                    <span className="flex items-center gap-2">
                      {l.meetingUrl ? <Badge variant="outline">{copy.course.live}</Badge> : null}
                      {enrolled ? (
                        <Badge variant={seenSet.has(l.id) ? "secondary" : "outline"}>
                          {seenSet.has(l.id) ? copy.course.seen : copy.course.pending}
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  )
}
