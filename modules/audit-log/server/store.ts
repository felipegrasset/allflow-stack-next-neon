/**
 * Database side. Takes `db` (a Kysely or a transaction) so a caller can record
 * the audit row in the same transaction as the change. Insert only: nothing
 * in this module updates or deletes audit rows.
 */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { buildDiff, normalizeGivenDiff } from "../contracts/diff"
import { AuditError } from "../contracts/errors"
import { auditEntrySchema, type AuditEntryInput } from "../contracts/input"

export type ResolvedActor = { id: string | null; name: string | null }

export function resolveActor(
  given: "system" | { id: string; name?: string | null | undefined } | undefined,
  fallback: ResolvedActor | null
): ResolvedActor {
  if (given === "system") return { id: null, name: null }
  if (given) return { id: given.id, name: given.name ?? null }
  if (!fallback) throw new AuditError("unauthenticated", "no session and no explicit actor")
  return fallback
}

export async function recordAuditWith(
  db: Kysely<Database>,
  input: AuditEntryInput,
  fallbackActor: ResolvedActor | null
): Promise<{ id: string }> {
  const parsed = auditEntrySchema.safeParse(input)
  if (!parsed.success) throw new AuditError("invalid_input", parsed.error.message)
  const v = parsed.data
  const actor = resolveActor(v.actor, fallbackActor)
  const diff = v.diff
    ? normalizeGivenDiff(v.diff, v.sensitive)
    : buildDiff(v.before, v.after, v.sensitive)
  const id = randomUUID()
  await db
    .insertInto("audit_log")
    .values({
      id,
      actor_id: actor.id,
      actor_name: actor.name,
      action: v.action,
      entity: v.entity,
      entity_id: v.entityId,
      diff: JSON.stringify(diff),
    })
    .execute()
  return { id }
}
