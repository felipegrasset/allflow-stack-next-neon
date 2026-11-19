/**
 * The only thing another module may import from `tickets`:
 *
 *   import { openTicket } from "@/modules/tickets/contracts"
 *   const { ticketId } = await openTicket({ subject: "No puedo pagar", body: "…", entity: "order", entityId: id })
 *
 * `openTicket` is server-only and runs as the signed-in user (needs a request
 * context and `ticket:create`). The rest is pure.
 */
export { openTicket } from "../server/api"
export {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  availableStatusMoves,
  canView,
  isTicketPriority,
  isTicketStatus,
  messageRecipients,
  planReply,
  planStatusChange,
  type AuthorKind,
  type ReplyPlan,
  type StatusPlan,
  type TicketPriority,
  type TicketStatus,
  type Viewer,
} from "./domain"
export { openTicketInputSchema, type OpenTicketInput } from "./input"
