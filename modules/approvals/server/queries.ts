import { getKysely } from "@/server/db/pool"

import { availableTransitions, findState, localize, type FlowTransition } from "../contracts/flow"
import type { ApprovalEvent } from "../contracts/types"
import type { Actor } from "./decision"
import { parseDefinition } from "./store"

/** How many open requests the inbox scans to find the ones the actor can act on (v0.1). */
const OPEN_SCAN_LIMIT = 200

export type RequestView = {
  id: string
  flowName: string
  title: string
  href: string | null
  entity: string
  entityId: string
  state: string
  stateLabel: string
  final: boolean
  requestedBy: string
  requesterName: string | null
  createdAt: Date
  closedAt: Date | null
  /** Transitions the actor may run now (role, `$requester` AND permission). */
  actions: { action: string; label: string; comment: FlowTransition["comment"] }[]
}

type Row = {
  id: string
  definition: unknown
  title: string
  href: string | null
  entity: string
  entity_id: string
  state: string
  requested_by: string
  requester_name: string | null
  created_at: Date
  closed_at: Date | null
}

function baseQuery() {
  return getKysely()
    .selectFrom("approvals_requests as r")
    .leftJoin("user as u", "u.id", "r.requested_by")
    .select([
      "r.id",
      "r.definition",
      "r.title",
      "r.href",
      "r.entity",
      "r.entity_id",
      "r.state",
      "r.requested_by",
      "u.name as requester_name",
      "r.created_at",
      "r.closed_at",
    ])
}

function toView(row: Row, actor: Actor, locale: string): RequestView {
  const def = parseDefinition(row.definition)
  const state = findState(def, row.state)
  const actions = row.closed_at
    ? []
    : availableTransitions(def, { state: row.state, actor, requestedBy: row.requested_by })
        .filter((t) => {
          const asRequester = actor.userId === row.requested_by && t.roles.includes("$requester")
          return asRequester ? actor.can.request : actor.can.decide
        })
        .map((t) => ({ action: t.action, label: localize(t.label, locale), comment: t.comment }))
  return {
    id: row.id,
    flowName: localize(def.name, locale),
    title: row.title,
    href: row.href,
    entity: row.entity,
    entityId: row.entity_id,
    state: row.state,
    stateLabel: state ? localize(state.label, locale) : row.state,
    final: state?.final ?? false,
    requestedBy: row.requested_by,
    requesterName: row.requester_name,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    actions,
  }
}

/** Open requests of OTHER people where the actor can run a transition by role. */
export async function listPending(actor: Actor, locale: string): Promise<RequestView[]> {
  if (!actor.can.decide) return []
  const rows = await baseQuery()
    .where("r.closed_at", "is", null)
    .where("r.requested_by", "!=", actor.userId)
    .orderBy("r.created_at", "asc")
    .limit(OPEN_SCAN_LIMIT)
    .execute()
  return rows.map((r) => toView(r, actor, locale)).filter((v) => v.actions.length > 0)
}

export async function listMine(actor: Actor, locale: string, limit = 50): Promise<RequestView[]> {
  const rows = await baseQuery()
    .where("r.requested_by", "=", actor.userId)
    .orderBy("r.created_at", "desc")
    .limit(limit)
    .execute()
  return rows.map((r) => toView(r, actor, locale))
}

/** One request, or null if it does not exist or the actor may not see it. */
export async function getRequestView(
  id: string,
  actor: Actor,
  locale: string
): Promise<RequestView | null> {
  const row = await baseQuery().where("r.id", "=", id).executeTakeFirst()
  if (!row) return null
  // Visible to the requester and to whoever holds approval:decide.
  if (row.requested_by !== actor.userId && !actor.can.decide) return null
  return toView(row, actor, locale)
}

export async function listEvents(requestId: string): Promise<ApprovalEvent[]> {
  const rows = await getKysely()
    .selectFrom("approvals_events as e")
    .leftJoin("user as u", "u.id", "e.actor_id")
    .select([
      "e.id",
      "e.request_id",
      "e.actor_id",
      "u.name as actor_name",
      "e.action",
      "e.from_state",
      "e.to_state",
      "e.comment",
      "e.created_at",
    ])
    .where("e.request_id", "=", requestId)
    .orderBy("e.created_at", "asc")
    .orderBy("e.id", "asc")
    .execute()
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    action: r.action,
    fromState: r.from_state,
    toState: r.to_state,
    comment: r.comment,
    createdAt: r.created_at,
  }))
}
