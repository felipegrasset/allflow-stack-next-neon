"use server"

import { revalidatePath } from "next/cache"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import "../register"
import { es } from "../messages"
import { actionSession } from "./guard"
import { JOB_NAME, getJob } from "./registry"
import { runJob } from "./runner"
import { createRunStore } from "./store"

export type RunNowResult = { ok: true; status: "succeeded" | "skipped" | "failed" } | { ok: false; error: string }

/**
 * Runs a job now, from /admin/jobs. Reachable by direct POST, so: (1) session
 * and `job:run` are checked BEFORE anything else, (2) the name is validated and
 * must be a registered job. The same database lock as cron applies.
 */
export async function runJobAction(name: string): Promise<RunNowResult> {
  const session = await actionSession("/admin/jobs", "run")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  if (typeof name !== "string" || !JOB_NAME.test(name)) return { ok: false, error: copy.errors.notFound }
  const def = getJob(name)
  if (!def) return { ok: false, error: copy.errors.notFound }
  try {
    const outcome = await runJob(def, createRunStore(getKysely()), { kind: "manual", triggeredBy: session.user.id })
    revalidatePath("/admin/jobs")
    return { ok: true, status: outcome.status }
  } catch (err) {
    console.error("[jobs] runJobAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
}
