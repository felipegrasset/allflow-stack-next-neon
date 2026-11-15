/** The functions behind `contracts/`. Server-only. */
import { sendEmail } from "@/server/email/send"
import { publicUrl } from "@/lib/site"
import { getKysely } from "@/server/db/pool"
import { notify } from "@/modules/notifications/contracts"
import type { NotifyInput, NotifyResult } from "@/modules/notifications/contracts"

import { deliverEmail, type EmailOutcome } from "./deliver"
import { getRecipientWith } from "./store"

export type NotifyWithEmailResult = NotifyResult & {
  /** What happened with the email. `skipped_duplicate`: the notice already existed (same `id`), no second email. */
  email: EmailOutcome | "skipped_duplicate"
}

/**
 * `notify()` plus an email to the same person, unless they turned it off.
 * The in-app notice is created first and always; the email is best effort and
 * never throws. Same input as `notify`. No-op for the email without RESEND_API_KEY.
 */
export async function notifyWithEmail(input: NotifyInput): Promise<NotifyWithEmailResult> {
  const res = await notify(input) // validates (Zod) and throws on invalid input, like notify
  if (!res.created) return { ...res, email: "skipped_duplicate" }
  const db = getKysely()
  const email = await deliverEmail(
    {
      getRecipient: (id) => getRecipientWith(db, id),
      send: sendEmail,
      env: { resendApiKey: process.env.RESEND_API_KEY, secret: process.env.BETTER_AUTH_SECRET },
      baseUrl: publicUrl(),
      log: (m, e) => console.error(m, e),
    },
    { userId: input.userId, title: input.title.trim(), body: input.body?.trim() || null, href: input.href ?? null }
  )
  return { ...res, email }
}
