import Link from "next/link"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { requireCoursesViewer } from "../server/guard"
import { listMyCourses } from "../server/queries"

/** /courses — the courses the person is enrolled in (only published ones) and their progress. */
export default async function CoursesPage() {
  const { session, canManage } = await requireCoursesViewer("/courses")
  const [copy, courses] = await Promise.all([getModuleCopy(es), listMyCourses(session.user.id)])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.list.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.list.subtitle}</p>
        </div>
        {canManage ? (
          <ButtonLink href="/admin/courses" variant="outline" size="sm">
            {copy.list.manageLink}
          </ButtonLink>
        ) : null}
      </div>

      <section className="flex flex-col gap-3" aria-label={copy.list.listLabel}>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {copy.list.count(courses.length)}
        </p>
        {courses.length === 0 ? (
          <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">{copy.list.empty}</p>
            <p className="text-sm text-muted-foreground">{copy.list.emptyHint}</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {courses.map((c) => {
              const p = { done: Math.min(c.done, c.total), total: c.total }
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">
                      <Link href={`/courses/${c.id}`} className="underline-offset-2 hover:underline">
                        {c.title}
                      </Link>
                    </h2>
                    {c.summary ? <p className="text-sm text-muted-foreground">{c.summary}</p> : null}
                  </div>
                  {c.total === 0 ? (
                    <Badge variant="outline" className="self-start">
                      {copy.list.noLessons}
                    </Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <progress
                        value={p.done}
                        max={p.total}
                        aria-label={copy.list.progress(p.done, p.total)}
                        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
                      />
                      <p className="text-xs text-muted-foreground">{copy.list.progress(p.done, p.total)}</p>
                    </div>
                  )}
                  <ButtonLink href={`/courses/${c.id}`} variant="outline" size="sm" className="self-start">
                    {copy.list.open}
                  </ButtonLink>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
