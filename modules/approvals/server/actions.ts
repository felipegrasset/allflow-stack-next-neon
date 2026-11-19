"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireOnboardedUser } from "@/server/session"

import { APPROVAL_ERROR_CODES, isApprovalError, type ApprovalErrorCode } from "../contracts/errors"
import { decide } from "./api"

export type DecideActionState =
  | { status: "idle" }
  | { status: "ok"; to: string }
  | { status: "error"; code: ApprovalErrorCode | "unknown" }

const formSchema = z.object({
  requestId: z.string().min(1).max(200),
  action: z.string().min(1).max(63),
  expectedState: z.string().min(1).max(63),
  comment: z.string().max(1000).optional(),
})

/**
 * Reachable by direct POST: guards the session, validates with zod, and
 * `decide` re-checks role, permission and state inside a row lock.
 */
export async function decideAction(
  _prev: DecideActionState,
  formData: FormData
): Promise<DecideActionState> {
  await requireOnboardedUser("/approvals")
  const parsed = formSchema.safeParse({
    requestId: formData.get("requestId"),
    action: formData.get("action"),
    expectedState: formData.get("expectedState"),
    comment: formData.get("comment") ?? undefined,
  })
  if (!parsed.success) return { status: "error", code: "invalid_input" }
  try {
    const r = await decide(parsed.data)
    revalidatePath("/approvals")
    revalidatePath(`/approvals/${r.requestId}`)
    return { status: "ok", to: r.to }
  } catch (e) {
    if (isApprovalError(e) && APPROVAL_ERROR_CODES.includes(e.code))
      return { status: "error", code: e.code }
    console.error("[approvals] decideAction failed", e)
    return { status: "error", code: "unknown" }
  }
}
