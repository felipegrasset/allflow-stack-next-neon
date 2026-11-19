/**
 * Mentions go through `notifications` (its contracts only). Best effort: a
 * failed notice never undoes a comment; it is logged and dropped. Only people
 * who exist and can see the record are told (the caller passes exactly those).
 * The text carries the author's NAME and never anyone's email. Idempotent per
 * comment and person. The text is in the language of whoever acts.
 */
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { notify } from "@/modules/notifications/contracts"

import { es } from "../messages"

export async function notifyMentions(args: {
  commentId: string
  authorName: string
  recipientIds: readonly string[]
  href: string
}): Promise<void> {
  if (args.recipientIds.length === 0) return
  try {
    const copy = await getModuleCopy(es)
    const title = copy.notify.mention(args.authorName).slice(0, 120)
    for (const r of await Promise.allSettled(
      args.recipientIds.map((userId) =>
        notify({ userId, title, href: args.href, kind: "info", id: `comments-${args.commentId}-${userId}` })
      )
    ))
      if (r.status === "rejected") console.error("[comments] notify failed", r.reason)
  } catch (e) {
    console.error("[comments] notify failed", e)
  }
}
