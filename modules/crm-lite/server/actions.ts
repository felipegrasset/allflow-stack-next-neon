"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import {
  crmSchemas,
  type ActivityInput,
  type ContactInput,
  type DealInput,
} from "../contracts/input"
import { es } from "../messages"
import { actionSession } from "./guard"
import {
  createActivity,
  createContact,
  createDeal,
  isUniqueViolation,
  moveDeal,
  updateContact,
} from "./mutations"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and permission with `actionSession` BEFORE touching data, (2) validates its
 * input again with the same Zod schema as the form, (3) only then writes.
 */

const idOk = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 100

function fieldErrors<K extends string>(
  error: z.ZodError
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out))
      out[key as K] = issue.message
  }
  return out
}

async function texts() {
  const copy = await getModuleCopy(es)
  return { copy, schemas: crmSchemas(copy.validation) }
}

export async function createContactAction(
  values: ContactInput
): Promise<FormResult<keyof ContactInput>> {
  const session = await actionSession("/crm/contacts", ["contact", "write"])
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const parsed = schemas.contactSchema.safeParse(values)
  if (!parsed.success)
    return {
      ok: false,
      formError: copy.errors.invalid,
      fieldErrors: fieldErrors(parsed.error),
    }
  try {
    const id = await createContact(parsed.data, session.user.id)
    revalidatePath("/crm/contacts")
    return { ok: true, redirectTo: `/crm/contacts/${id}` }
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, fieldErrors: { email: copy.validation.emailTaken } }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function updateContactAction(
  id: string,
  values: ContactInput
): Promise<FormResult<keyof ContactInput>> {
  const session = await actionSession("/crm/contacts", ["contact", "write"])
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(id)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.contactSchema.safeParse(values)
  if (!parsed.success)
    return {
      ok: false,
      formError: copy.errors.invalid,
      fieldErrors: fieldErrors(parsed.error),
    }
  try {
    const found = await updateContact(id, parsed.data)
    if (!found) return { ok: false, formError: copy.errors.notFound }
    revalidatePath("/crm", "layout")
    return { ok: true, message: copy.actions.saved }
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, fieldErrors: { email: copy.validation.emailTaken } }
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function createDealAction(
  contactId: string,
  values: DealInput
): Promise<FormResult<keyof DealInput>> {
  const session = await actionSession(
    "/crm/contacts",
    ["contact", "read"],
    ["deal", "write"]
  )
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(contactId)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.dealSchema.safeParse(values)
  if (!parsed.success)
    return {
      ok: false,
      formError: copy.errors.invalid,
      fieldErrors: fieldErrors(parsed.error),
    }
  try {
    const id = await createDeal(contactId, parsed.data, session.user.id)
    if (!id) return { ok: false, formError: copy.errors.notFound }
    revalidatePath("/crm", "layout")
    return { ok: true, message: copy.actions.dealCreated }
  } catch {
    return { ok: false, formError: copy.errors.generic }
  }
}

export type MoveDealResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "not_found" | "conflict" | "error" }

export async function moveDealAction(input: {
  id: string
  from: string
  to: string
}): Promise<MoveDealResult> {
  const session = await actionSession("/crm", ["deal", "write"])
  if (!session) return { ok: false, reason: "forbidden" }
  const parsed = crmSchemas().moveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: "invalid" }
  try {
    const res = await moveDeal(
      parsed.data.id,
      parsed.data.from,
      parsed.data.to,
      session.user.id
    )
    if (!res.ok) return { ok: false, reason: res.reason }
    revalidatePath("/crm", "layout")
    return { ok: true }
  } catch {
    return { ok: false, reason: "error" }
  }
}

export async function logActivityAction(
  contactId: string,
  values: ActivityInput
): Promise<FormResult<keyof ActivityInput>> {
  const session = await actionSession("/crm/contacts", ["contact", "write"])
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(contactId)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.activitySchema.safeParse(values)
  if (!parsed.success)
    return {
      ok: false,
      formError: copy.errors.invalid,
      fieldErrors: fieldErrors(parsed.error),
    }
  try {
    const id = await createActivity(contactId, parsed.data, session.user.id)
    if (!id) return { ok: false, formError: copy.errors.notFound }
    revalidatePath(`/crm/contacts/${contactId}`)
    return { ok: true, message: copy.actions.logged }
  } catch {
    return { ok: false, formError: copy.errors.generic }
  }
}
