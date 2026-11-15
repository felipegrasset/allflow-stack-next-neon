"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { findMentions } from "../contracts/domain"
import { commentSchemas, type AddCommentInput } from "../contracts/input"
import { es } from "../messages"
import { actionSession, can } from "./guard"
import { verifyGrant } from "./grant"
import { notifyMentions } from "./notify"
import { deleteCommentWith, existingPeople, insertComment } from "./store"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and permission BEFORE touching data, (2) verifies the signed access grant
 * (issued by `<Comments>` after the host's `canAccess` check) and that it is
 * the signed-in user's, (3) validates with the same Zod schema as the form.
 */

const secret = () => process.env.BETTER_AUTH_SECRET

export type DeleteActionResult = { ok: true } | { ok: false; error: string }

export async function addCommentAction(token: string, values: AddCommentInput): Promise<FormResult<keyof AddCommentInput>> {
  const copy = await getModuleCopy(es)
  const session = await actionSession("/", "create")
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const grant = verifyGrant(token, secret())
  if (!grant || grant.u !== session.user.id) return { ok: false, formError: copy.errors.forbidden }
  const parsed = commentSchemas(copy.validation).addSchema.safeParse(values)
  if (!parsed.success) {
    const body = parsed.error.issues[0]?.message
    return { ok: false, formError: copy.errors.invalid, fieldErrors: body ? { body } : undefined }
  }
  try {
    const db = getKysely()
    const id = await insertComment(db, { entity: grant.e, entityId: grant.i, authorId: session.user.id, body: parsed.data.body })
    // Mentions: only people the host said can see the record, who still exist.
    const people = await existingPeople(db, grant.m)
    await notifyMentions({
      commentId: id,
      authorName: session.user.name,
      recipientIds: findMentions(parsed.data.body, people, session.user.id),
      href: grant.h,
    })
    revalidatePath(grant.h.split(/[?#]/)[0])
    return { ok: true, message: copy.added }
  } catch (err) {
    console.error("[comments] addCommentAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}

export async function deleteCommentAction(token: string, commentId: string): Promise<DeleteActionResult> {
  const copy = await getModuleCopy(es)
  // Deleting your own comment needs no permission of its own beyond the grant; moderation needs comment:delete.
  const session = await actionSession("/")
  if (!session) return { ok: false, error: copy.errors.forbidden }
  const grant = verifyGrant(token, secret())
  if (!grant || grant.u !== session.user.id) return { ok: false, error: copy.errors.forbidden }
  if (typeof commentId !== "string" || commentId.length < 1 || commentId.length > 100)
    return { ok: false, error: copy.errors.notFound }
  try {
    const res = await deleteCommentWith(
      getKysely(),
      { userId: session.user.id, canDelete: await can("delete") },
      grant.e,
      grant.i,
      commentId
    )
    if (!res.ok) return { ok: false, error: res.reason === "forbidden" ? copy.errors.forbidden : copy.errors.notFound }
    revalidatePath(grant.h.split(/[?#]/)[0])
    return { ok: true }
  } catch (err) {
    console.error("[comments] deleteCommentAction failed", err)
    return { ok: false, error: copy.errors.generic }
  }
}
