"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { normalizeCode } from "../contracts/domain"
import {
  createCodeSchema,
  setActiveSchema,
  toCodeData,
  updateCodeSchema,
  type CodeField,
  type CreateCodeInput,
  type SetActiveInput,
  type UpdateCodeInput,
} from "../contracts/input"
import { DiscountError, type DiscountErrorCode } from "../contracts/types"
import { es } from "../messages"
import { canManageDiscounts } from "./authz"
import { safeLog } from "./log"
import { ADMIN_PATH } from "./paths"
import { fail } from "./result"
import * as store from "./store"

/**
 * The code editor of /admin/discounts. Every action is reachable by direct
 * POST, so each one: (1) checks the session and `discount:manage` BEFORE
 * touching data, (2) validates its input (Zod + `toCodeData`, the same rules
 * the database checks), (3) answers with a translated code. No hard delete:
 * a code with uses is history (deactivate it instead).
 */

async function managerOnly(): Promise<{ userId: string } | null> {
  const session = await requireOnboardedUser(ADMIN_PATH)
  return (await canManageDiscounts()) ? { userId: session.user.id } : null
}

const codeOf = (err: unknown): DiscountErrorCode => (err instanceof DiscountError ? err.code : "unknown")

async function fieldFail<K extends string>(fields: Partial<Record<CodeField | "code", string>>): Promise<FormResult<K>> {
  const copy = await getModuleCopy(es)
  const fe = copy.admin.fieldErrors
  const out: Partial<Record<K, string>> = {}
  for (const [k, v] of Object.entries(fields)) out[k as K] = fe[v as keyof typeof fe] ?? fe.invalid
  return { ok: false, formError: copy.errors.invalid_input, fieldErrors: out }
}

async function saved<K extends string>(redirectTo?: string): Promise<FormResult<K>> {
  revalidatePath(ADMIN_PATH)
  const copy = await getModuleCopy(es)
  return { ok: true, message: copy.admin.saved, redirectTo }
}

export async function createCodeAction(values: CreateCodeInput): Promise<FormResult<CodeField | "code">> {
  const who = await managerOnly()
  if (!who) return fail("forbidden")
  const parsed = createCodeSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  const code = normalizeCode(parsed.data.code)
  const data = toCodeData(parsed.data)
  if (!code || !data.ok) return fieldFail({ ...(data.ok ? {} : data.fields), ...(code ? {} : { code: "invalid" }) })
  try {
    const id = await store.createCode(getKysely(), { code, active: parsed.data.active, data: data.data, createdBy: who.userId })
    return saved(`${ADMIN_PATH}?id=${encodeURIComponent(id)}`)
  } catch (err) {
    const c = codeOf(err)
    if (c === "code_taken") {
      const copy = await getModuleCopy(es)
      return fail(c, { code: copy.errors.code_taken })
    }
    safeLog("createCode", err)
    return fail(c)
  }
}

export async function updateCodeAction(values: UpdateCodeInput): Promise<FormResult<CodeField>> {
  if (!(await managerOnly())) return fail("forbidden")
  const parsed = updateCodeSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  const data = toCodeData(parsed.data)
  if (!data.ok) return fieldFail(data.fields)
  try {
    await store.updateCode(getKysely(), parsed.data.codeId, data.data)
  } catch (err) {
    safeLog("updateCode", err)
    return fail(codeOf(err))
  }
  return saved()
}

export async function setActiveAction(values: SetActiveInput): Promise<FormResult<"active">> {
  if (!(await managerOnly())) return fail("forbidden")
  const parsed = setActiveSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  try {
    await store.setActive(getKysely(), parsed.data.codeId, parsed.data.active)
  } catch (err) {
    safeLog("setActive", err)
    return fail(codeOf(err))
  }
  return saved()
}
