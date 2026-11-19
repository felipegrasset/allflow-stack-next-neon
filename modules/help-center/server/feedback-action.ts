"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { clientIp, consume } from "@/server/rate-limit"

import { articleSchemas } from "../contracts/input"
import { es } from "../messages"
import { recordFeedback } from "./mutations"
import type { FeedbackState } from "./state"
import { VOTER_COOKIE, ensureToken, hashVoter } from "./voter"

/** At most this many ratings per visitor (IP) in the window, whatever the article or cookie. */
const FEEDBACK_RULE = { max: 10, windowMs: 60_000 }

/**
 * PUBLIC on purpose ("¿te sirvió?" is for visitors). It has no permission
 * check, so it only accepts a slug of a PUBLISHED article, validates every
 * field, stores a hash of an anonymous cookie (one rating per visitor and
 * article; voting again replaces it) and never reads anything back. Votes are
 * rate limited per IP (`consume`), so clearing cookies does not allow flooding.
 */
export async function submitFeedbackAction(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const copy = await getModuleCopy(es)
  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === "string" ? v : ""
  }
  const parsed = articleSchemas(copy.validation).feedbackSchema.safeParse({
    slug: get("slug"),
    helpful: get("helpful"),
    comment: get("comment"),
  })
  if (!parsed.success) return { status: "error", message: copy.feedback.error }

  try {
    const limited = await consume(`help-center:feedback:${await clientIp()}`, FEEDBACK_RULE)
    if (!limited.ok) return { status: "error", message: copy.feedback.rateLimited }
  } catch {
    return { status: "error", message: copy.feedback.error }
  }

  const jar = await cookies()
  const { token, isNew } = ensureToken(jar.get(VOTER_COOKIE)?.value)
  try {
    const saved = await recordFeedback({
      slug: parsed.data.slug,
      voterHash: hashVoter(token),
      helpful: parsed.data.helpful === "yes",
      comment: parsed.data.comment,
    })
    if (!saved) return { status: "error", message: copy.feedback.error }
  } catch {
    return { status: "error", message: copy.feedback.error }
  }
  if (isNew)
    jar.set(VOTER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  revalidatePath("/admin/help")
  return { status: "ok", helpful: parsed.data.helpful === "yes" }
}
