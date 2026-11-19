"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { isImportError } from "../contracts/errors"
import { prepareImport } from "../contracts/plan"
import { MAX_CSV_BYTES } from "../contracts/parse"
import { findImportTarget } from "../contracts/registry"
import { es } from "../messages"
import "../targets"
import { actionSession } from "./guard"
import type { PreviewPayload, RunPayload } from "./payload"
import { runImportWith } from "./store"

/**
 * Reachable by direct POST: (1) session + `import:run` BEFORE touching
 * anything, (2) the input is validated with Zod, (3) the target must be
 * registered (the allow-list), (4) the file is parsed and validated again on
 * the server: the client's preview is never trusted, (5) only then it writes.
 */
const inputSchema = z.object({
  targetId: z.string().min(1).max(63),
  text: z.string().max(MAX_CSV_BYTES),
  fileName: z.string().max(255).nullable().optional(),
  delimiter: z.enum(["auto", ",", ";", "\t"]).default("auto"),
  mapping: z.record(z.string().max(63), z.number().int().min(0).max(1000).nullable()).optional(),
  skipInvalid: z.boolean().default(false),
})

export type ImportInput = z.input<typeof inputSchema>

export async function previewImportAction(input: ImportInput): Promise<PreviewPayload> {
  const session = await actionSession("/admin/import")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: copy.errors.invalid }
  const { targetId, text, delimiter, mapping } = parsed.data
  const target = findImportTarget(targetId)
  if (!target) return { ok: false, error: copy.parseErrors.unknown_target }
  try {
    const p = prepareImport(target, text, { delimiter: delimiter === "auto" ? undefined : delimiter, mapping })
    return {
      ok: true,
      delimiter: p.delimiter,
      headers: p.headers,
      mapping: p.mapping,
      missing: p.missing,
      totalRows: p.plan?.totalRows ?? 0,
      validRows: p.plan?.valid.length ?? 0,
      errorRows: p.plan?.errorRowCount ?? 0,
      errors: p.plan?.errors ?? [],
      sample: p.plan?.sample ?? [],
    }
  } catch (err) {
    if (isImportError(err)) return { ok: false, error: copy.parseErrors[err.code] }
    console.error("[csv-import] previewImportAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
}

export async function runImportAction(input: ImportInput): Promise<RunPayload> {
  const session = await actionSession("/admin/import")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: copy.errors.invalid }
  const { targetId, text, delimiter, mapping, skipInvalid, fileName } = parsed.data
  const target = findImportTarget(targetId)
  if (!target) return { ok: false, error: copy.parseErrors.unknown_target }
  let prepared
  try {
    prepared = prepareImport(target, text, { delimiter: delimiter === "auto" ? undefined : delimiter, mapping })
  } catch (err) {
    if (isImportError(err)) return { ok: false, error: copy.parseErrors[err.code] }
    console.error("[csv-import] runImportAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
  const plan = prepared.plan
  if (!plan) return { ok: false, error: copy.errors.invalid }
  if (plan.errorRowCount > 0 && !skipInvalid) return { ok: false, error: copy.errors.hasErrors }
  const out = await runImportWith(
    getKysely(),
    target,
    plan.valid.map((r) => r.values),
    { userId: session.user.id, fileName: fileName ?? null, totalRows: plan.totalRows, skippedRows: plan.errorRowCount }
  )
  revalidatePath("/admin/import")
  if (!out.ok) return { ok: false, error: copy.errors.insertFailed }
  return { ok: true, imported: out.imported, skipped: plan.errorRowCount }
}
