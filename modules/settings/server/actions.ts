"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { isSettingError } from "../contracts/errors"
import { findDefinition, parseRaw, validateValue } from "../contracts/registry"
import "../definitions"
import { es } from "../messages"
import { getKysely } from "@/server/db/pool"
import { actionSession } from "./guard"
import { resetWith, setWith } from "./store"

const keyOk = (k: unknown): k is string => typeof k === "string" && k.length > 0 && k.length <= 100
const rawOk = (r: unknown): r is string => typeof r === "string" && r.length <= 20000

/**
 * Reachable by direct POST: (1) session + `setting:write` BEFORE touching
 * data, (2) the key must be a defined setting, (3) the value is validated with
 * the setting's own schema, (4) only then it writes.
 */
export async function saveSettingAction(key: string, raw: string): Promise<FormResult<"value">> {
  const session = await actionSession("/admin/settings", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!keyOk(key) || !rawOk(raw)) return { ok: false, formError: copy.errors.invalid }
  const def = findDefinition(key)
  if (!def) return { ok: false, formError: copy.errors.unknown }
  const parsed = parseRaw(def, raw)
  if (!parsed.ok) return { ok: false, fieldErrors: { value: copy.errors.invalid } }
  try {
    validateValue(def, parsed.value)
  } catch {
    return { ok: false, fieldErrors: { value: copy.errors.invalid } }
  }
  try {
    await setWith(getKysely(), def, parsed.value, session.user.id)
    revalidatePath("/admin/settings")
    return { ok: true, message: copy.form.saved }
  } catch (err) {
    if (!isSettingError(err)) console.error("[settings] saveSettingAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function resetSettingAction(key: string): Promise<FormResult<"value">> {
  const session = await actionSession("/admin/settings", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!keyOk(key)) return { ok: false, formError: copy.errors.invalid }
  if (!findDefinition(key)) return { ok: false, formError: copy.errors.unknown }
  try {
    await resetWith(getKysely(), key)
    revalidatePath("/admin/settings")
    return { ok: true, message: copy.form.resetDone }
  } catch (err) {
    console.error("[settings] resetSettingAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}
