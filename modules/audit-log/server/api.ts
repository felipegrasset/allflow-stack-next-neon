/** Functions behind `contracts/`. Server-only. */
import type { Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"
import { getSession } from "@/server/session"

import { AuditError } from "../contracts/errors"
import type { AuditEntryInput } from "../contracts/input"
import { recordAuditWith, type ResolvedActor } from "./store"
import { createAudited } from "./wrap"

async function sessionActor(): Promise<ResolvedActor | null> {
  const session = await getSession()
  return session ? { id: session.user.id, name: session.user.name ?? null } : null
}

/**
 * Records one audit row, by default as the signed-in user (needs a request
 * context); pass `actor` for jobs and webhooks. Redacts sensitive fields.
 * No permission check: the caller is trusted server code.
 */
export async function recordAudit(entry: AuditEntryInput): Promise<{ id: string }> {
  return recordAuditWith(getKysely(), entry, await sessionActor())
}

/**
 * Same, inside the caller's transaction (the row commits or rolls back with
 * the change). Needs an explicit `actor`: it never reads the session.
 */
export async function recordAuditIn(
  trx: Kysely<Database>,
  entry: AuditEntryInput & { actor: NonNullable<AuditEntryInput["actor"]> }
): Promise<{ id: string }> {
  if (!entry.actor) throw new AuditError("invalid_input", "recordAuditIn needs an explicit actor")
  return recordAuditWith(trx, entry, null)
}

/** Wraps a server function: after it succeeds, records an audit row. See server/wrap.ts. */
export const audited = createAudited(recordAudit)

export { AuditError }
