/**
 * Zod schemas of crm-lite. One schema per form, shared by the client
 * (`zodResolver`) and the Server Action (`safeParse` again: actions are
 * reachable by direct POST). They are factories because the error messages
 * depend on the locale: pass `copy.validation` (messages.ts). Without it Zod's
 * default messages are used (server-to-server callers of the contracts).
 * Pure: no `@/` imports.
 */
import { z } from "zod"

import {
  CONTACT_STATUSES,
  CURRENCIES,
  DEAL_STAGES,
  MANUAL_ACTIVITY_KINDS,
} from "./domain"
import { parseAmount } from "./money"

export type ValidationMessages = {
  required: string
  tooLong: string
  email: string
  amount: string
  invalid: string
}

const isEmail = (v: string) => z.email().safeParse(v).success

export function crmSchemas(v?: Partial<ValidationMessages>) {
  const required = (max: number) =>
    z.string().trim().min(1, v?.required).max(max, v?.tooLong)
  const optional = (max: number) => z.string().trim().max(max, v?.tooLong)
  const choice = <T extends readonly [string, ...string[]]>(values: T) =>
    z.enum(values, v?.invalid)

  const contactSchema = z.object({
    name: required(200),
    email: optional(320).refine((s) => s === "" || isEmail(s), v?.email),
    phone: optional(40),
    company: optional(200),
    status: choice(CONTACT_STATUSES),
    notes: optional(2000),
  })

  const dealSchema = z
    .object({
      name: required(200),
      amount: z.string().trim().max(30, v?.tooLong),
      currency: choice(CURRENCIES),
      stage: choice(DEAL_STAGES),
    })
    .superRefine((d, ctx) => {
      if (d.amount !== "" && parseAmount(d.amount, d.currency) === null)
        ctx.addIssue({ code: "custom", path: ["amount"], message: v?.amount })
    })

  const activitySchema = z.object({
    kind: choice(MANUAL_ACTIVITY_KINDS),
    body: required(2000),
    /** "" = not linked to a deal. */
    dealId: z.string().max(100),
  })

  const moveSchema = z.object({
    id: z.string().min(1).max(100),
    from: z.enum(DEAL_STAGES),
    to: z.enum(DEAL_STAGES),
  })

  return { contactSchema, dealSchema, activitySchema, moveSchema }
}

type Schemas = ReturnType<typeof crmSchemas>
export type ContactInput = z.infer<Schemas["contactSchema"]>
export type DealInput = z.infer<Schemas["dealSchema"]>
export type ActivityInput = z.infer<Schemas["activitySchema"]>
export type MoveInput = z.infer<Schemas["moveSchema"]>

/** Input of `upsertContact` (contracts): for other modules' server code. */
export const upsertContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .max(320)
    .pipe(z.email())
    .transform((s) => s.toLowerCase())
    .optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  /** Only advances: a customer never goes back to lead. */
  status: z.enum(CONTACT_STATUSES).optional(),
})
export type UpsertContactInput = z.input<typeof upsertContactSchema>

/** Input of `logActivity` (contracts). */
export const logActivitySchema = z.object({
  contactId: z.string().min(1).max(100),
  kind: z.enum(MANUAL_ACTIVITY_KINDS),
  body: z.string().trim().min(1).max(2000),
  dealId: z.string().min(1).max(100).optional(),
  authorId: z.string().min(1).max(100).optional(),
})
export type LogActivityInput = z.input<typeof logActivitySchema>
