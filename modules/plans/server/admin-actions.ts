"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import type { PlansErrorCode } from "../contracts/errors"
import {
  createPlanSchema,
  planIdSchema,
  removeEntitlementSchema,
  setArchivedSchema,
  setEntitlementSchema,
  setPublishedSchema,
  updatePlanSchema,
  type CreatePlanInput,
  type RemoveEntitlementInput,
  type SetArchivedInput,
  type SetEntitlementInput,
  type SetPublishedInput,
  type UpdatePlanInput,
} from "../contracts/input"
import { es } from "../messages"
import { canManagePlans } from "./authz"
import { safeLog } from "./log"
import { ADMIN_PATH, SETTINGS_PATH } from "./paths"
import { codeOf, fail, invalid } from "./result"
import * as store from "./store"

/**
 * The catalog editor of /admin/plans. Every action is reachable by direct
 * POST, so each one: (1) checks the session and `plan:manage` BEFORE touching
 * data, (2) validates its input with Zod, (3) writes in ONE transaction
 * (server/store.ts), (4) answers with a translated code, never a raw error.
 * There is no hard delete of plans in v0.2.
 */

async function managerOnly(): Promise<PlansErrorCode | null> {
  await requireOnboardedUser(ADMIN_PATH)
  return (await canManagePlans()) ? null : "forbidden"
}

async function saved<K extends string>(): Promise<FormResult<K>> {
  revalidatePath(ADMIN_PATH)
  revalidatePath(SETTINGS_PATH)
  const copy = await getModuleCopy(es)
  return { ok: true, message: copy.manage.saved }
}

/** The field a store error belongs to, so the form can point at it. */
function fieldOf(code: PlansErrorCode): string | null {
  if (code === "ref_taken" || code === "ref_required") return "planRef"
  if (code === "key_taken") return "key"
  return null
}

async function storeFail<K extends string>(op: string, err: unknown): Promise<FormResult<K>> {
  safeLog(op, err)
  const code = codeOf(err)
  const field = fieldOf(code)
  if (!field) return fail(code)
  const copy = await getModuleCopy(es)
  return fail(code, { [field]: copy.errors[code] } as Partial<Record<K, string>>)
}

export async function createPlanAction(
  values: CreatePlanInput
): Promise<FormResult<keyof CreatePlanInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = createPlanSchema.safeParse(values)
  if (!parsed.success) {
    const copy = await getModuleCopy(es)
    return invalid(parsed.error.issues, { planRef: copy.errors.invalid_ref, key: copy.errors.invalid_key })
  }
  let id: string
  try {
    id = await store.createPlan(getKysely(), parsed.data)
  } catch (err) {
    return storeFail("createPlan", err)
  }
  revalidatePath(ADMIN_PATH)
  const copy = await getModuleCopy(es)
  return { ok: true, message: copy.manage.saved, redirectTo: `${ADMIN_PATH}?id=${encodeURIComponent(id)}` }
}

export async function updatePlanAction(
  values: UpdatePlanInput
): Promise<FormResult<keyof UpdatePlanInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = updatePlanSchema.safeParse(values)
  if (!parsed.success) {
    const copy = await getModuleCopy(es)
    return invalid(parsed.error.issues, { planRef: copy.errors.invalid_ref })
  }
  try {
    await store.updatePlan(getKysely(), parsed.data)
  } catch (err) {
    return storeFail("updatePlan", err)
  }
  return saved()
}

export async function setPublishedAction(
  values: SetPublishedInput
): Promise<FormResult<keyof SetPublishedInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = setPublishedSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  try {
    await store.setPublished(getKysely(), parsed.data.planId, parsed.data.published)
  } catch (err) {
    safeLog("setPublished", err)
    return fail(codeOf(err))
  }
  return saved()
}

export async function setArchivedAction(
  values: SetArchivedInput
): Promise<FormResult<keyof SetArchivedInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = setArchivedSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  try {
    await store.setArchived(
      getKysely(),
      parsed.data.planId,
      parsed.data.archived,
      parsed.data.newDefaultPlanId
    )
  } catch (err) {
    safeLog("setArchived", err)
    return fail(codeOf(err))
  }
  return saved()
}

export async function setDefaultPlanAction(planId: string): Promise<FormResult<"planId">> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = planIdSchema.safeParse({ planId })
  if (!parsed.success) return fail("invalid_input")
  try {
    await store.setDefaultPlan(getKysely(), parsed.data.planId)
  } catch (err) {
    safeLog("setDefaultPlan", err)
    return fail(codeOf(err))
  }
  return saved()
}

export async function setEntitlementAction(
  values: SetEntitlementInput
): Promise<FormResult<keyof SetEntitlementInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = setEntitlementSchema.safeParse(values)
  if (!parsed.success) {
    const copy = await getModuleCopy(es)
    return invalid(parsed.error.issues, { key: copy.errors.invalid_key })
  }
  try {
    await store.setEntitlement(getKysely(), parsed.data)
  } catch (err) {
    safeLog("setEntitlement", err)
    return fail(codeOf(err))
  }
  return saved()
}

export async function removeEntitlementAction(
  values: RemoveEntitlementInput
): Promise<FormResult<keyof RemoveEntitlementInput>> {
  const denied = await managerOnly()
  if (denied) return fail(denied)
  const parsed = removeEntitlementSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  try {
    await store.removeEntitlement(getKysely(), parsed.data.planId, parsed.data.key)
  } catch (err) {
    safeLog("removeEntitlement", err)
    return fail(codeOf(err))
  }
  return saved()
}
