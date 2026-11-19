/**
 * The functions behind `contracts/`: resolve the actor from the session, run
 * the store, then notify. Server-only.
 */
import { getLocale } from "next-intl/server"

import { getKysely } from "@/server/db/pool"

import { ApprovalError } from "../contracts/errors"
import type { FlowDefinitionInput } from "../contracts/flow"
import { findState, localize } from "../contracts/flow"
import type {
  ApprovalStatus,
  DecideInput,
  DecideResult,
  RequestApprovalInput,
  RequestApprovalResult,
} from "../contracts/types"
import { currentActor } from "./authz"
import { notifyAfterChange } from "./notify"
import { decideWith, parseDefinition, requestApprovalWith, saveFlowWith } from "./store"

/** Opens a request for the signed-in user. Needs `approval:request`. */
export async function requestApproval(input: RequestApprovalInput): Promise<RequestApprovalResult> {
  const actor = await currentActor()
  const r = await requestApprovalWith(getKysely(), actor, input)
  await notifyAfterChange({
    requestId: r.requestId,
    eventId: r.eventId,
    title: r.title,
    definition: r.definition,
    state: r.state,
    final: false,
    actorId: actor.userId,
    requestedBy: actor.userId,
  })
  return { requestId: r.requestId, state: r.state, eventId: r.eventId }
}

/** Runs a transition as the signed-in user. Invalid transition → ApprovalError, never a no-op. */
export async function decide(input: DecideInput): Promise<DecideResult> {
  const actor = await currentActor()
  const r = await decideWith(getKysely(), actor, input)
  await notifyAfterChange({
    requestId: r.requestId,
    eventId: r.eventId,
    title: r.title,
    definition: r.definition,
    state: r.to,
    final: r.final,
    actorId: actor.userId,
    requestedBy: r.requestedBy,
  })
  return { requestId: r.requestId, eventId: r.eventId, from: r.from, to: r.to, final: r.final }
}

/**
 * Status of a record: its open request, or else the most recent closed one;
 * null if it never had one. With `flowKey`, only that flow. NO permission
 * check: the calling module decides who may see the record.
 */
export async function getStatus(
  entity: string,
  entityId: string,
  opts: { flowKey?: string } = {}
): Promise<ApprovalStatus | null> {
  let q = getKysely()
    .selectFrom("approvals_requests")
    .selectAll()
    .where("entity", "=", entity)
    .where("entity_id", "=", entityId)
  if (opts.flowKey) q = q.where("flow_key", "=", opts.flowKey)
  const row = await q
    .orderBy((eb) => eb("closed_at", "is", null), "desc")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst()
  if (!row) return null
  const def = parseDefinition(row.definition)
  const state = findState(def, row.state)
  const locale = await getLocale().catch(() => "es")
  return {
    requestId: row.id,
    flowKey: row.flow_key,
    entity: row.entity,
    entityId: row.entity_id,
    title: row.title,
    href: row.href,
    state: row.state,
    stateLabel: state ? localize(state.label, locale) : row.state,
    final: state?.final ?? false,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  }
}

/** Creates or replaces a flow by key (validated). Caller checks its own permission. */
export async function saveFlow(
  input: FlowDefinitionInput,
  opts: { active?: boolean } = {}
): Promise<{ id: string; key: string }> {
  return saveFlowWith(getKysely(), input, opts)
}

export { ApprovalError }
