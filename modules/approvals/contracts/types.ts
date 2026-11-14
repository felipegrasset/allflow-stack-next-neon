import { z } from "zod"

/** Only internal paths: "/x", never "//host", "/\\host" or "https://…" (no open redirect). */
export const INTERNAL_HREF = /^\/(?![/\\])[^\s]*$/

const entitySchema = z.string().trim().regex(/^[a-z0-9][a-z0-9_.-]{0,62}$/)

export const requestApprovalInputSchema = z.object({
  /** Key of a saved, active flow (`saveFlow`). */
  flowKey: z.string().min(1).max(63),
  /** The app's entity, lower case ("expense", "purchase_order"). No foreign key. */
  entity: entitySchema,
  /** Id of the record in that entity. */
  entityId: z.string().trim().min(1).max(200),
  /** What the decider sees in the inbox ("Gasto de viaje — $120.000"). */
  title: z.string().trim().min(1).max(160),
  /** Optional link to the record, internal path only. */
  href: z.string().regex(INTERNAL_HREF).max(500).optional(),
  comment: z.string().trim().max(1000).optional(),
})
export type RequestApprovalInput = z.input<typeof requestApprovalInputSchema>

export const decideInputSchema = z.object({
  requestId: z.string().min(1).max(200),
  action: z.string().min(1).max(63),
  comment: z.string().trim().max(1000).optional(),
  /**
   * Optional optimistic check: the state the person saw. If the request moved
   * meanwhile, `decide` throws `conflict` instead of acting on a stale screen.
   */
  expectedState: z.string().min(1).max(63).optional(),
})
export type DecideInput = z.input<typeof decideInputSchema>

export type ApprovalStatus = {
  requestId: string
  flowKey: string
  entity: string
  entityId: string
  title: string
  href: string | null
  state: string
  /** Label in the active locale. */
  stateLabel: string
  final: boolean
  requestedBy: string
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
}

export type ApprovalEvent = {
  id: string
  requestId: string
  actorId: string
  /** Null when the user was deleted (history survives). */
  actorName: string | null
  /** "request" for the creation event; the transition's action otherwise. */
  action: string
  fromState: string | null
  toState: string
  comment: string | null
  createdAt: Date
}

export type DecideResult = {
  requestId: string
  eventId: string
  from: string
  to: string
  final: boolean
}

export type RequestApprovalResult = { requestId: string; state: string; eventId: string }

/** The action recorded on a request's first event. */
export const REQUEST_EVENT_ACTION = "request"
