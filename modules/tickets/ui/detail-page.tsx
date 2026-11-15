import Link from "next/link"
import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { availableStatusMoves, canView } from "../contracts/domain"
import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { getTicket, listMessages } from "../server/queries"
import { asLocale } from "./format"
import { ReplyForm } from "./reply-form"
import { StatusBadge } from "./status-badge"
import { StatusControls } from "./status-controls"

const linkClass =
  "rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/** /tickets/[id] — thread, reply box and status buttons. Not yours and no `manage` → 404 (never reveals it exists). */
export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePagePermission(`/tickets/${encodeURIComponent(id)}`, "read")
  if (id.length > 100) notFound()
  const [copy, locale, canManage, ticket] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    can("manage"),
    getTicket(id),
  ])
  const viewer = { userId: session.user.id, canManage }
  if (!ticket || !canView(ticket, viewer)) notFound()
  const messages = await listMessages(ticket.id)
  const fromStaff = canManage && ticket.requesterId !== viewer.userId
  const moves = availableStatusMoves(ticket, viewer)

  return (
    <div className="flex flex-col gap-6">
      <Link href={fromStaff ? "/admin/tickets" : "/tickets"} className={linkClass}>
        {fromStaff ? copy.admin.title : copy.detail.back}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={ticket.status} label={copy.detail.statusLabel(copy.statuses[ticket.status])} />
          <Badge variant="outline">{copy.detail.priorityLabel(copy.priorities[ticket.priority])}</Badge>
          <span>· {copy.detail.openedBy(ticket.requesterName ?? copy.detail.unknownUser)}</span>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="tickets-thread">
        <h2 id="tickets-thread" className="text-base font-medium">
          {copy.detail.thread}
        </h2>
        <ol className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.authorName ?? copy.detail.unknownUser}</span>
                {m.authorKind === "staff" ? <Badge variant="secondary">{copy.detail.staffTag}</Badge> : null}
                <time dateTime={m.createdAt.toISOString()}>{formatDateTime(m.createdAt, locale)}</time>
              </p>
              <p className="text-sm whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {ticket.status === "closed" ? (
        <p className="text-sm text-muted-foreground">{copy.detail.closedNote}</p>
      ) : (
        <ReplyForm ticketId={ticket.id} />
      )}

      {moves.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="tickets-status">
          <h2 id="tickets-status" className="text-base font-medium">
            {copy.detail.actionsTitle}
          </h2>
          <StatusControls ticketId={ticket.id} moves={moves} />
        </section>
      ) : null}
    </div>
  )
}
