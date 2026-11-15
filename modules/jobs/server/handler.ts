/** Logic of GET|POST /api/jobs/[name]. Pure: the secret, the registry and the runner are injected. */
import { checkCronAuth } from "./secret"
import { JOB_NAME, type JobDefinition, type RunKind } from "./registry"
import type { RunOutcome } from "./runner"

export type HandlerDeps = {
  secret: () => string | undefined
  getJob: (name: string) => JobDefinition | undefined
  run: (def: JobDefinition, kind: RunKind) => Promise<RunOutcome>
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

/**
 * Order matters: authentication first (so an unauthenticated caller learns
 * nothing about which jobs exist), then the name, then the run.
 * 503 not configured · 401 bad secret · 404 unknown job · 409 already running ·
 * 500 the job failed (no error text in the body: it is in the run history) · 200 ok.
 */
export async function handleJobRequest(req: Request, name: string, deps: HandlerDeps): Promise<Response> {
  const auth = checkCronAuth(req.headers.get("authorization"), deps.secret())
  if (auth === "not_configured") return json(503, { error: "not_configured" })
  if (auth !== "ok") return json(401, { error: "unauthorized" })

  const def = JOB_NAME.test(name) ? deps.getJob(name) : undefined
  if (!def) return json(404, { error: "unknown_job" })

  const outcome = await deps.run(def, "cron")
  switch (outcome.status) {
    case "skipped":
      return json(409, { status: "skipped", job: outcome.name })
    case "failed":
      return json(500, { status: "failed", job: outcome.name, runId: outcome.runId })
    default:
      return json(200, {
        status: "succeeded",
        job: outcome.name,
        runId: outcome.runId,
        durationMs: outcome.durationMs,
      })
  }
}
