import { sql } from "kysely"

import { getKysely } from "@/server/db/pool"

import { PAGE_SIZE, encodeCursor, likePattern, type AuditFilters } from "./filters"

export type AuditRow = {
  id: string
  actorId: string | null
  actorName: string | null
  action: string
  entity: string
  entityId: string
  /** Stored diff, read back as parsed JSON (parse with `parseDiff`). */
  diff: unknown
  createdAt: Date
}

/** Newest first, keyset-paginated. Every value is a bound parameter. */
export async function listAudit(
  filters: AuditFilters
): Promise<{ rows: AuditRow[]; nextCursor: string | null }> {
  let q = getKysely()
    .selectFrom("audit_log")
    .select([
      "id",
      "actor_id",
      "actor_name",
      "action",
      "entity",
      "entity_id",
      "diff",
      "created_at",
      // text keeps microseconds, which a JS Date would lose in the cursor
      sql<string>`created_at::text`.as("created_at_text"),
    ])
  if (filters.entity) q = q.where("entity", "=", filters.entity)
  if (filters.action) q = q.where("action", "like", `${likePattern(filters.action)}%`)
  if (filters.actor) {
    const actor = filters.actor
    q = q.where((eb) =>
      eb.or([eb("actor_id", "=", actor), eb("actor_name", "ilike", `%${likePattern(actor)}%`)])
    )
  }
  if (filters.from) q = q.where("created_at", ">=", filters.from)
  if (filters.to) q = q.where("created_at", "<", filters.to)
  if (filters.cursor) {
    const { at, id } = filters.cursor
    q = q.where(sql<boolean>`(created_at, id) < (${at}::timestamptz, ${id})`)
  }
  const rows = await q
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(PAGE_SIZE + 1)
    .execute()
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  return {
    rows: page.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      diff: r.diff,
      createdAt: r.created_at,
    })),
    nextCursor:
      rows.length > PAGE_SIZE && last ? encodeCursor({ at: last.created_at_text, id: last.id }) : null,
  }
}

/** Entities and actions seen so far, for the filter lists (bounded). */
export async function listFacets(): Promise<{ entities: string[]; actions: string[] }> {
  const db = getKysely()
  const [entities, actions] = await Promise.all([
    db.selectFrom("audit_log").select("entity").groupBy("entity").orderBy("entity").limit(200).execute(),
    db.selectFrom("audit_log").select("action").groupBy("action").orderBy("action").limit(200).execute(),
  ])
  return { entities: entities.map((r) => r.entity), actions: actions.map((r) => r.action) }
}
