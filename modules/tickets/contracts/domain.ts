/**
 * Pure rules of tickets: statuses, who may see a ticket, who may move it where,
 * what a reply does to the status and who gets told. No `@/` imports, so the
 * tests run it as is.
 */

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ["low", "normal", "high"] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export type AuthorKind = "requester" | "staff"

export const isTicketStatus = (v: unknown): v is TicketStatus =>
  typeof v === "string" && (TICKET_STATUSES as readonly string[]).includes(v)

export const isTicketPriority = (v: unknown): v is TicketPriority =>
  typeof v === "string" && (TICKET_PRIORITIES as readonly string[]).includes(v)

/** The person looking: their id and whether they hold `ticket:manage`. */
export type Viewer = { userId: string; canManage: boolean }

/** Everyone sees their own tickets; `manage` sees all. Anything else is "not found". */
export function canView(ticket: { requesterId: string }, viewer: Viewer): boolean {
  return viewer.canManage || ticket.requesterId === viewer.userId
}

const STAFF_MOVES: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["open", "in_progress", "closed"],
  closed: ["open"],
}

/** The requester can close their own ticket and reopen it; nothing else. */
const REQUESTER_MOVES: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ["closed"],
  in_progress: ["closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
}

export type StatusPlan =
  | { ok: true; closes: boolean }
  | { ok: false; reason: "not_found" | "same_status" | "invalid_transition" }

/** Can `viewer` move a ticket from `from` to `to`? Pure; the store re-checks it inside a row lock. */
export function planStatusChange(
  ticket: { requesterId: string; status: TicketStatus },
  to: TicketStatus,
  viewer: Viewer
): StatusPlan {
  if (!canView(ticket, viewer)) return { ok: false, reason: "not_found" }
  if (ticket.status === to) return { ok: false, reason: "same_status" }
  const table = viewer.canManage ? STAFF_MOVES : REQUESTER_MOVES
  if (!table[ticket.status].includes(to)) return { ok: false, reason: "invalid_transition" }
  return { ok: true, closes: to === "closed" }
}

/** The moves available to `viewer` from the ticket's current status (for the buttons). */
export function availableStatusMoves(
  ticket: { requesterId: string; status: TicketStatus },
  viewer: Viewer
): TicketStatus[] {
  if (!canView(ticket, viewer)) return []
  return [...(viewer.canManage ? STAFF_MOVES : REQUESTER_MOVES)[ticket.status]]
}

export type ReplyPlan =
  | { ok: true; kind: AuthorKind; nextStatus: TicketStatus }
  | { ok: false; reason: "not_found" | "closed" }

/**
 * What happens when `viewer` writes on a ticket. The ticket's own requester
 * writes as "requester" (a reply on a resolved ticket reopens it); a manager
 * writing on someone else's ticket writes as "staff" (the first answer moves
 * an open ticket to in_progress). A closed ticket takes no messages: reopen it first.
 */
export function planReply(
  ticket: { requesterId: string; status: TicketStatus },
  viewer: Viewer
): ReplyPlan {
  if (!canView(ticket, viewer)) return { ok: false, reason: "not_found" }
  if (ticket.status === "closed") return { ok: false, reason: "closed" }
  const kind: AuthorKind = ticket.requesterId === viewer.userId ? "requester" : "staff"
  let nextStatus = ticket.status
  if (kind === "requester" && ticket.status === "resolved") nextStatus = "open"
  if (kind === "staff" && ticket.status === "open") nextStatus = "in_progress"
  return { ok: true, kind, nextStatus }
}

/**
 * Who is told about a message: the requester when staff wrote, the managers
 * when the requester wrote. Never the author, no repeats.
 */
export function messageRecipients(args: {
  kind: AuthorKind
  authorId: string
  requesterId: string
  managerIds: readonly string[]
}): string[] {
  const pool = args.kind === "staff" ? [args.requesterId] : [...args.managerIds]
  return [...new Set(pool)].filter((id) => id !== args.authorId)
}
