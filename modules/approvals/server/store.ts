/**
 * Database side of the module. Every function takes `db` (injected, so a seed
 * or a test can pass its own) and, when it changes state, the `Actor` already
 * resolved from the session. Kysely only: no SQL built from strings.
 */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { ApprovalError } from "../contracts/errors"
import {
  defineFlow,
  findState,
  flowDefinitionSchema,
  type FlowDefinition,
  type FlowDefinitionInput,
} from "../contracts/flow"
import {
  REQUEST_EVENT_ACTION,
  decideInputSchema,
  requestApprovalInputSchema,
  type DecideInput,
  type DecideResult,
  type RequestApprovalInput,
  type RequestApprovalResult,
} from "../contracts/types"
import { planDecision, storedComment, type Actor } from "./decision"

type Db = Kysely<Database>

/** Reads a stored definition back through the schema (a corrupt row is an error, not a guess). */
export function parseDefinition(raw: unknown): FlowDefinition {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw
  const r = flowDefinitionSchema.safeParse(value)
  if (!r.success) throw new ApprovalError("invalid_flow", "stored definition is invalid")
  return r.data
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505"
}

/**
 * Creates or replaces a flow by key. Requests already open keep the snapshot
 * they were created with. Not a Server Action: call it from server code (a
 * seed, an admin action that already checked its own permission).
 */
export async function saveFlowWith(
  db: Db,
  input: FlowDefinitionInput,
  opts: { active?: boolean } = {}
): Promise<{ id: string; key: string }> {
  const def = defineFlow(input)
  const row = await db
    .insertInto("approvals_flows")
    .values({
      id: randomUUID(),
      key: def.key,
      definition: JSON.stringify(def),
      active: opts.active ?? true,
    })
    .onConflict((oc) =>
      oc.column("key").doUpdateSet({
        definition: JSON.stringify(def),
        active: opts.active ?? true,
        updated_at: new Date(),
      })
    )
    .returning(["id", "key"])
    .executeTakeFirstOrThrow()
  return row
}

export async function requestApprovalWith(
  db: Db,
  actor: Actor,
  input: RequestApprovalInput
): Promise<RequestApprovalResult & { definition: FlowDefinition; title: string }> {
  const parsed = requestApprovalInputSchema.safeParse(input)
  if (!parsed.success) throw new ApprovalError("invalid_input", parsed.error.message)
  const v = parsed.data
  if (!actor.can.request) throw new ApprovalError("forbidden", "missing approval:request")

  const flow = await db
    .selectFrom("approvals_flows")
    .select(["id", "key", "definition", "active"])
    .where("key", "=", v.flowKey)
    .executeTakeFirst()
  if (!flow) throw new ApprovalError("flow_not_found", v.flowKey)
  if (!flow.active) throw new ApprovalError("flow_inactive", v.flowKey)
  const def = parseDefinition(flow.definition)

  const requestId = randomUUID()
  const eventId = randomUUID()
  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("approvals_requests")
        .values({
          id: requestId,
          flow_id: flow.id,
          flow_key: flow.key,
          definition: JSON.stringify(def),
          entity: v.entity,
          entity_id: v.entityId,
          title: v.title,
          href: v.href ?? null,
          state: def.initial,
          requested_by: actor.userId,
        })
        .execute()
      await trx
        .insertInto("approvals_events")
        .values({
          id: eventId,
          request_id: requestId,
          actor_id: actor.userId,
          action: REQUEST_EVENT_ACTION,
          from_state: null,
          to_state: def.initial,
          comment: v.comment ?? null,
        })
        .execute()
    })
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApprovalError("already_open", `${v.entity}:${v.entityId}`)
    throw e
  }
  return { requestId, state: def.initial, eventId, definition: def, title: v.title }
}

export async function decideWith(
  db: Db,
  actor: Actor,
  input: DecideInput
): Promise<DecideResult & { definition: FlowDefinition; title: string; requestedBy: string }> {
  const parsed = decideInputSchema.safeParse(input)
  if (!parsed.success) throw new ApprovalError("invalid_input", parsed.error.message)
  const v = parsed.data

  return db.transaction().execute(async (trx) => {
    // Row lock: two deciders clicking at once serialize here; the second one
    // sees the new state and fails with invalid_transition (or conflict).
    const req = await trx
      .selectFrom("approvals_requests")
      .select(["id", "state", "requested_by", "closed_at", "definition", "title"])
      .where("id", "=", v.requestId)
      .forUpdate()
      .executeTakeFirst()
    if (!req) throw new ApprovalError("request_not_found", v.requestId)
    const def = parseDefinition(req.definition)

    const t = planDecision(
      { state: req.state, requestedBy: req.requested_by, closedAt: req.closed_at, definition: def },
      actor,
      { action: v.action, comment: v.comment, expectedState: v.expectedState }
    )
    const final = findState(def, t.to)?.final ?? false
    const now = new Date()
    const upd = await trx
      .updateTable("approvals_requests")
      .set({ state: t.to, updated_at: now, closed_at: final ? now : null })
      .where("id", "=", req.id)
      .where("state", "=", t.from)
      .executeTakeFirst()
    if (Number(upd.numUpdatedRows) !== 1) throw new ApprovalError("conflict")

    const eventId = randomUUID()
    await trx
      .insertInto("approvals_events")
      .values({
        id: eventId,
        request_id: req.id,
        actor_id: actor.userId,
        action: t.action,
        from_state: t.from,
        to_state: t.to,
        comment: storedComment(t, v.comment),
      })
      .execute()
    return {
      requestId: req.id,
      eventId,
      from: t.from,
      to: t.to,
      final,
      definition: def,
      title: req.title,
      requestedBy: req.requested_by,
    }
  })
}
