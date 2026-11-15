/**
 * Zod schemas of tickets. One per form, shared by the client (`zodResolver`)
 * and the Server Action (`safeParse` again: actions are reachable by direct
 * POST). Factories because the error texts depend on the locale: pass
 * `copy.validation`. Pure: no `@/` imports.
 */
import { z } from "zod"

import { TICKET_PRIORITIES, TICKET_STATUSES } from "./domain"

export type ValidationMessages = { required: string; tooLong: string; invalid: string }

export function ticketSchemas(v?: Partial<ValidationMessages>) {
  const required = (max: number) => z.string().trim().min(1, v?.required).max(max, v?.tooLong)

  const createSchema = z.object({
    subject: required(200),
    body: required(5000),
    priority: z.enum(TICKET_PRIORITIES, v?.invalid),
  })
  const replySchema = z.object({ body: required(5000) })
  const statusSchema = z.object({ status: z.enum(TICKET_STATUSES, v?.invalid) })
  return { createSchema, replySchema, statusSchema }
}

type Schemas = ReturnType<typeof ticketSchemas>
export type CreateTicketInput = z.infer<Schemas["createSchema"]>
export type ReplyInput = z.infer<Schemas["replySchema"]>

/** Input of `openTicket` (contracts), for other modules' server code. */
export const openTicketInputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  /** Optional record of the app the ticket is about (no foreign key). */
  entity: z.string().trim().regex(/^[a-z0-9][a-z0-9_.-]{0,62}$/).optional(),
  entityId: z.string().trim().min(1).max(200).optional(),
})
export type OpenTicketInput = z.input<typeof openTicketInputSchema>
