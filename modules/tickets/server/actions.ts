"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { type Viewer } from "../contracts/domain"
import { ticketSchemas, type CreateTicketInput, type ReplyInput } from "../contracts/input"
import { es } from "../messages"
import { actionSession, can } from "./guard"
import { notifyMessage, notifyStatus } from "./notify"
import { addMessageWith, changeStatusWith, createTicketWith, type StoreFailure } from "./store"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and permission BEFORE touching data, (2) validates again with the same Zod
 * schema as the form, (3) only then writes (the store re-applies the rules
 * under a row lock).
 */

const idOk = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 100

function fieldErrors<K extends string>(error: z.ZodError): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out)) out[key as K] = issue.message
  }
  return out
}

async function texts() {
  const copy = await getModuleCopy(es)
  return { copy, schemas: ticketSchemas(copy.validation) }
}

function failureText(copy: Awaited<ReturnType<typeof texts>>["copy"], reason: StoreFailure): string {
  switch (reason) {
    case "not_found":
      return copy.errors.notFound
    case "closed":
      return copy.errors.closed
    case "same_status":
      return copy.errors.sameStatus
    default:
      return copy.errors.invalidTransition
  }
}

/** Viewing needs `read` (own tickets) or `manage` (all); `manage` widens the scope. */
async function viewerFor(userId: string): Promise<Viewer> {
  return { userId, canManage: await can("manage") }
}

export async function createTicketAction(values: CreateTicketInput): Promise<FormResult<keyof CreateTicketInput>> {
  const session = await actionSession("/tickets", "create")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const parsed = schemas.createSchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const { ticketId, messageId } = await createTicketWith(getKysely(), session.user.id, parsed.data)
    await notifyMessage({
      ticketId,
      messageId,
      subject: parsed.data.subject,
      kind: "requester",
      authorId: session.user.id,
      requesterId: session.user.id,
      isNewTicket: true,
    })
    revalidatePath("/tickets")
    revalidatePath("/admin/tickets")
    return { ok: true, redirectTo: `/tickets/${ticketId}` }
  } catch (err) {
    console.error("[tickets] createTicketAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function replyAction(ticketId: string, values: ReplyInput): Promise<FormResult<keyof ReplyInput>> {
  const session = await actionSession("/tickets", "read")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  if (!idOk(ticketId)) return { ok: false, formError: copy.errors.notFound }
  const parsed = schemas.replySchema.safeParse(values)
  if (!parsed.success)
    return { ok: false, formError: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }
  try {
    const res = await addMessageWith(getKysely(), await viewerFor(session.user.id), ticketId, parsed.data.body)
    if (!res.ok) return { ok: false, formError: failureText(copy, res.reason) }
    await notifyMessage({
      ticketId,
      messageId: res.messageId,
      subject: res.subject,
      kind: res.kind,
      authorId: session.user.id,
      requesterId: res.requesterId,
      isNewTicket: false,
    })
    revalidatePath(`/tickets/${ticketId}`)
    revalidatePath("/tickets")
    revalidatePath("/admin/tickets")
    return { ok: true, message: copy.detail.sent }
  } catch (err) {
    console.error("[tickets] replyAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}

export type StatusActionResult = { ok: true } | { ok: false; error: string }

export async function changeStatusAction(ticketId: string, status: string): Promise<StatusActionResult> {
  const session = await actionSession("/tickets", "read")
  const { copy, schemas } = await texts()
  if (!session) return { ok: false, error: copy.errors.forbidden }
  if (!idOk(ticketId)) return { ok: false, error: copy.errors.notFound }
  const parsed = schemas.statusSchema.safeParse({ status })
  if (!parsed.success) return { ok: false, error: copy.errors.invalid }
  try {
    const res = await changeStatusWith(getKysely(), await viewerFor(session.user.id), ticketId, parsed.data.status)
    if (!res.ok) return { ok: false, error: failureText(copy, res.reason) }
    await notifyStatus({
      ticketId,
      subject: res.subject,
      status: res.status,
      actorId: session.user.id,
      requesterId: res.requesterId,
    })
    revalidatePath(`/tickets/${ticketId}`)
    revalidatePath("/tickets")
    revalidatePath("/admin/tickets")
    return { ok: true }
  } catch (err) {
    console.error("[tickets] changeStatusAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
}
