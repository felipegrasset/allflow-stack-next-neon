import { getKysely } from "@/server/db/pool"

import "../../register"
import { handleJobRequest } from "../handler"
import { getJob } from "../registry"
import { runJob } from "../runner"
import { createRunStore } from "../store"

/**
 * GET|POST /api/jobs/<name> — the shim lives in app/api/jobs/[name]/route.ts
 * (written by `pnpm modules:sync`). Public URL, authenticated by CRON_SECRET
 * (Authorization: Bearer …), compared in constant time. Vercel Cron sends GET.
 */
async function handle(req: Request, ctx: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await ctx.params
  return handleJobRequest(req, name, {
    secret: () => process.env.CRON_SECRET,
    getJob,
    run: (def, kind) => runJob(def, createRunStore(getKysely()), { kind }),
  })
}

export const GET = handle
export const POST = handle
