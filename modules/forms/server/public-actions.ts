"use server"

import { revalidatePath } from "next/cache"
import { getLocale } from "next-intl/server"

import { getSession } from "@/server/session"
import { clientIp, consume } from "@/server/rate-limit"

import type { AnswerErrorCode } from "../contracts/answers"
import { slugSchema } from "../contracts/definition"
import type { FormErrorCode } from "../contracts/errors"
import { CONTROL_PREFIX, HONEYPOT_FIELD } from "../contracts/names"
import { getFormBySlug, insertResponse, isUniqueViolation } from "./store"
import { planSubmission } from "./submission"

/** At most this many submissions per visitor (IP) and form in the window. */
const SUBMIT_RULE = { max: 10, windowMs: 60_000 }

export type SubmitState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; code: FormErrorCode | "unknown"; fields?: Record<string, AnswerErrorCode> }

/**
 * Public: anyone may send a response to an OPEN form. Reachable by direct POST,
 * so everything is re-checked here: the form exists and is open, the visitor
 * is under the rate limit, a honeypot hit is dropped silently (it answers
 * "ok" so a bot learns nothing), one-per-person needs a session, and the
 * answers are validated against the stored definition. The user id comes from
 * the session, never from the input.
 */
export async function submitResponseAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  try {
    const slug = slugSchema.safeParse(formData.get("slug"))
    if (!slug.success) return { status: "error", code: "not_found" }
    const form = await getFormBySlug(slug.data)
    // A draft is invisible to the public, same as a form that does not exist.
    if (!form || form.status === "draft") return { status: "error", code: "not_found" }

    const limited = await consume(`forms:submit:${await clientIp()}:${form.id}`, SUBMIT_RULE)
    if (!limited.ok) return { status: "error", code: "rate_limited" }

    const raw: Record<string, unknown> = {}
    for (const f of form.definition.fields) {
      const values = formData.getAll(CONTROL_PREFIX + f.id)
      if (values.length === 1) raw[f.id] = values[0]
      else if (values.length > 1) raw[f.id] = values
    }
    const honeypot = formData.get(HONEYPOT_FIELD)
    const session = await getSession()
    const plan = planSubmission(form, {
      honeypot: typeof honeypot === "string" ? honeypot : "",
      userId: session?.user.id ?? null,
      raw,
    })

    if (plan.kind === "ignored") return { status: "ok" }
    if (plan.kind === "rejected") return { status: "error", code: plan.code }
    if (plan.kind === "invalid") return { status: "error", code: "invalid_input", fields: plan.errors }

    try {
      await insertResponse({
        formId: form.id,
        answers: plan.answers,
        respondentKey: plan.respondentKey,
        locale: await getLocale(),
      })
    } catch (e) {
      if (isUniqueViolation(e)) return { status: "error", code: "already_responded" }
      throw e
    }
    revalidatePath(`/forms/${form.id}`)
    revalidatePath("/forms")
    return { status: "ok" }
  } catch (e) {
    console.error("[forms] submitResponseAction failed", e)
    return { status: "error", code: "unknown" }
  }
}
