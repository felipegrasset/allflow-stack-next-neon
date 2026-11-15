"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { describeIssues, formDefinitionSchema } from "../contracts/definition"
import { isFormError, type FormErrorCode } from "../contracts/errors"
import { FORM_STATUSES, type FormStatus } from "../contracts/types"
import { createForm } from "./api"
import { actionSession } from "./authz"
import { deleteForm, setFormStatus } from "./store"

/** Admin actions. Reachable by direct POST: each checks session + `form:write` BEFORE touching data. */

export type CreateFormState =
  | { status: "idle" }
  | { status: "ok"; id: string }
  | { status: "error"; code: FormErrorCode | "invalid_json" | "unknown"; issues?: string[] }

const MAX_DEFINITION_CHARS = 100_000

export async function createFormAction(_prev: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const session = await actionSession("/forms", "write")
  if (!session) return { status: "error", code: "forbidden" }

  const text = formData.get("definition")
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_DEFINITION_CHARS)
    return { status: "error", code: "invalid_input" }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { status: "error", code: "invalid_json" }
  }
  const parsed = formDefinitionSchema.safeParse(json)
  if (!parsed.success)
    return { status: "error", code: "invalid_definition", issues: describeIssues(parsed.error) }

  try {
    const { id } = await createForm({
      slug: String(formData.get("slug") ?? "").trim(),
      definition: parsed.data,
      onePerPerson: formData.get("onePerPerson") === "on",
      createdBy: session.user.id,
    })
    revalidatePath("/forms")
    return { status: "ok", id }
  } catch (e) {
    if (isFormError(e)) return { status: "error", code: e.code }
    console.error("[forms] createFormAction failed", e)
    return { status: "error", code: "unknown" }
  }
}

export type SimpleState = { status: "idle" } | { status: "ok" } | { status: "error"; code: FormErrorCode | "unknown" }

const idSchema = z.string().min(1).max(100)

export async function setStatusAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const session = await actionSession("/forms", "write")
  if (!session) return { status: "error", code: "forbidden" }
  const id = idSchema.safeParse(formData.get("id"))
  const status = z.enum(FORM_STATUSES).safeParse(formData.get("status"))
  if (!id.success || !status.success) return { status: "error", code: "invalid_input" }
  try {
    const found = await setFormStatus(id.data, status.data as FormStatus)
    if (!found) return { status: "error", code: "not_found" }
    revalidatePath("/forms")
    revalidatePath(`/forms/${id.data}`)
    return { status: "ok" }
  } catch (e) {
    console.error("[forms] setStatusAction failed", e)
    return { status: "error", code: "unknown" }
  }
}

export async function deleteFormAction(_prev: SimpleState, formData: FormData): Promise<SimpleState> {
  const session = await actionSession("/forms", "write")
  if (!session) return { status: "error", code: "forbidden" }
  const id = idSchema.safeParse(formData.get("id"))
  if (!id.success) return { status: "error", code: "invalid_input" }
  try {
    const found = await deleteForm(id.data)
    if (!found) return { status: "error", code: "not_found" }
    revalidatePath("/forms")
    return { status: "ok" }
  } catch (e) {
    console.error("[forms] deleteFormAction failed", e)
    return { status: "error", code: "unknown" }
  }
}
