import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import "../register"
import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { listJobs } from "../server/registry"
import { lastRunByJob, listRuns, type RunRow } from "../server/queries"
import { formatDuration } from "./format"
import { activeLocale } from "./locale"
import { RunButton } from "./run-button"

function StatusBadge({ status, label }: { status: RunRow["status"]; label: string }) {
  const variant = status === "failed" ? "destructive" : status === "succeeded" ? "secondary" : "outline"
  return <Badge variant={variant}>{label}</Badge>
}

/** /admin/jobs — registered jobs with their last run, plus the history. Needs `job:read`; "Run now" needs `job:run`. */
export default async function JobsPage() {
  await requirePagePermission("/admin/jobs", "read")
  const [copy, locale, canRun, last, runs] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    can("run"),
    lastRunByJob(),
    listRuns(50),
  ])
  const jobs = listJobs()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="jobs-list">
        <h2 id="jobs-list" className="text-base font-medium">{copy.jobs.title}</h2>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm font-medium">
            {copy.jobs.empty}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.jobs.name}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.jobs.description}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.jobs.schedule}</TableHead>
                <TableHead>{copy.jobs.last}</TableHead>
                {canRun ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const run = last.get(j.name)
                return (
                  <TableRow key={j.name}>
                    <TableCell className="font-medium">{j.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{j.description ?? "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {j.schedule ? <code>{j.schedule}</code> : copy.jobs.scheduleNone}
                    </TableCell>
                    <TableCell>
                      {run ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={run.status} label={copy.statuses[run.status]} />
                          <time dateTime={run.startedAt.toISOString()} className="text-xs text-muted-foreground">
                            {formatDateTime(run.startedAt, locale)}
                          </time>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{copy.jobs.never}</span>
                      )}
                    </TableCell>
                    {canRun ? (
                      <TableCell>
                        <RunButton name={j.name} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="jobs-history">
        <h2 id="jobs-history" className="text-base font-medium">{copy.runs.title}</h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">{copy.runs.count(runs.length)}</p>
        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm font-medium">
            {copy.runs.empty}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.runs.when}</TableHead>
                <TableHead>{copy.runs.job}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.runs.kind}</TableHead>
                <TableHead>{copy.runs.status}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.runs.duration}</TableHead>
                <TableHead className="hidden lg:table-cell">{copy.runs.error}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={r.startedAt.toISOString()}>{formatDateTime(r.startedAt, locale)}</time>
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{copy.kinds[r.kind]}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} label={copy.statuses[r.status]} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDuration(r.durationMs)}</TableCell>
                  <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell" title={r.error ?? undefined}>
                    {r.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
