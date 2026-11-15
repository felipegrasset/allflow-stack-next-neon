/**
 * Who is told what, through `notifications` (its contracts only). Best effort:
 * a failed notice never undoes a ticket change; it is logged and dropped.
 * The text is in the language of whoever acts (notifications stores literal text).
 *
 * Managers are whoever holds `ticket:manage` (static or dynamic roles), resolved
 * by `notifyPermission` of `notifications`; the requester is told through `notify`.
 */

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { notify, notifyPermission } from "@/modules/notifications/contracts"

import { messageRecipients, type AuthorKind, type TicketStatus } from "../contracts/domain"
import { es } from "../messages"

const MAX_RECIPIENTS = 50

async function settle(sends: Promise<unknown>[]): Promise<void> {
  for (const r of await Promise.allSettled(sends))
    if (r.status === "rejected") console.error("[tickets] notify failed", r.reason)
}

/** A new ticket or a new message: `kind` is who wrote it. */
export async function notifyMessage(args: {
  ticketId: string
  messageId: string
  subject: string
  kind: AuthorKind
  authorId: string
  requesterId: string
  isNewTicket: boolean
}): Promise<void> {
  try {
    const copy = await getModuleCopy(es)
    const title = (args.isNewTicket ? copy.notify.newTicket(args.subject) : copy.notify.reply(args.subject)).slice(0, 120)
    const href = `/tickets/${args.ticketId}`
    if (args.kind === "requester") {
      // The requester wrote: tell everyone who can manage tickets, except the author.
      const res = await notifyPermission(
        { resource: "ticket", action: "manage" },
        { title, href, kind: "info", id: `tickets-${args.messageId}` },
        { excludeUserIds: [args.authorId], limit: MAX_RECIPIENTS }
      )
      if (res.truncated) console.error("[tickets] notify: more managers than the limit, some were not told")
      return
    }
    // Staff wrote: tell the requester (never the author).
    const recipients = messageRecipients({
      kind: args.kind,
      authorId: args.authorId,
      requesterId: args.requesterId,
      managerIds: [],
    })
    await settle(
      recipients.map((userId) =>
        notify({ userId, title, href, kind: "info", id: `tickets-${args.messageId}-${userId}` })
      )
    )
  } catch (e) {
    console.error("[tickets] notify failed", e)
  }
}

/** A status change made by someone else than the requester: tell the requester. */
export async function notifyStatus(args: {
  ticketId: string
  subject: string
  status: TicketStatus
  actorId: string
  requesterId: string
}): Promise<void> {
  if (args.actorId === args.requesterId) return
  try {
    const copy = await getModuleCopy(es)
    await settle([
      notify({
        userId: args.requesterId,
        title: copy.notify.status(args.subject, copy.statuses[args.status]).slice(0, 120),
        href: `/tickets/${args.ticketId}`,
        kind: args.status === "resolved" ? "success" : "info",
        id: `tickets-${args.ticketId}-${args.status}-${Date.now()}`,
      }),
    ])
  } catch (e) {
    console.error("[tickets] notify failed", e)
  }
}
