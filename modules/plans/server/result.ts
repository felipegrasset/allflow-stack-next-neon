import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { PlansError, type PlansErrorCode } from "../contracts/errors"
import { es } from "../messages"

/** A failed action, with the translated text of `code` (never a raw error message). */
export async function fail<K extends string>(
  code: PlansErrorCode,
  fieldErrors?: Partial<Record<K, string>>
): Promise<FormResult<K>> {
  const copy = await getModuleCopy(es)
  return { ok: false, formError: copy.errors[code], fieldErrors }
}

export function codeOf(err: unknown): PlansErrorCode {
  return err instanceof PlansError ? err.code : "unknown"
}

/** Zod issues → one "check this field" per top-level field. */
export async function invalid<K extends string>(
  issues: readonly { path: readonly PropertyKey[] }[],
  special: Partial<Record<K, string>> = {}
): Promise<FormResult<K>> {
  const copy = await getModuleCopy(es)
  const fieldErrors: Partial<Record<K, string>> = {}
  for (const issue of issues) {
    const k = issue.path[0]
    if (typeof k === "string") fieldErrors[k as K] = special[k as K] ?? copy.errors.invalid_field
  }
  return { ok: false, formError: copy.errors.invalid_input, fieldErrors }
}
