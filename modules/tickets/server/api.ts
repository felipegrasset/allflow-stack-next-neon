/** The function behind `contracts/openTicket`. Server-only; needs a request context. */
import { getKysely } from "@/server/db/pool"

import { openTicketInputSchema, type OpenTicketInput } from "../contracts/input"
import { can } from "./guard"
import { notifyMessage } from "./notify"
import { createTicketWith } from "./store"
import { getSession } from "@/server/session"

/**
 * Opens a ticket as the signed-in user (needs `ticket:create`) and tells the
 * managers. Throws `Error` on no session, no permission or invalid input.
 */
export async function openTicket(input: OpenTicketInput): Promise<{ ticketId: string }> {
  const session = await getSession()
  if (!session) throw new Error("tickets: unauthenticated")
  if (!(await can("create"))) throw new Error("tickets: missing ticket:create")
  const parsed = openTicketInputSchema.safeParse(input)
  if (!parsed.success) throw new Error(`tickets: invalid input: ${parsed.error.message}`)
  const { ticketId, messageId } = await createTicketWith(getKysely(), session.user.id, parsed.data)
  await notifyMessage({
    ticketId,
    messageId,
    subject: parsed.data.subject,
    kind: "requester",
    authorId: session.user.id,
    requesterId: session.user.id,
    isNewTicket: true,
  })
  return { ticketId }
}
