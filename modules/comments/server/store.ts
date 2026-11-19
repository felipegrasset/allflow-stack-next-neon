/**
 * Database side. Every function takes `db` (injected). Kysely only. The store
 * never decides who may see a thread: the caller already did (grant).
 */
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { LIST_LIMIT, canDeleteComment, type Person, type Viewer } from "../contracts/domain"
import "../db/types"

type Db = Kysely<Database>

export type CommentRow = {
  id: string
  authorId: string
  /** null = the author's account no longer exists. Never an email. */
  authorName: string | null
  body: string
  createdAt: Date
}

export async function insertComment(
  db: Db,
  input: { entity: string; entityId: string; authorId: string; body: string }
): Promise<string> {
  const id = randomUUID()
  await db
    .insertInto("comments")
    .values({ id, entity: input.entity, entity_id: input.entityId, author_id: input.authorId, body: input.body })
    .execute()
  return id
}

/** Oldest first; the latest LIST_LIMIT. Names only, never emails. */
export async function listComments(db: Db, entity: string, entityId: string): Promise<CommentRow[]> {
  const rows = await db
    .selectFrom("comments as c")
    .leftJoin("user as u", "u.id", "c.author_id")
    .select(["c.id", "c.author_id", "u.name as author_name", "c.body", "c.created_at"])
    .where("c.entity", "=", entity)
    .where("c.entity_id", "=", entityId)
    .orderBy("c.created_at", "desc")
    .orderBy("c.id", "desc")
    .limit(LIST_LIMIT)
    .execute()
  return rows
    .map((r) => ({ id: r.id, authorId: r.author_id, authorName: r.author_name, body: r.body, createdAt: r.created_at }))
    .reverse()
}

/** Users that exist among `ids` (id + name only). Used to keep mentions to real people. */
export async function existingPeople(db: Db, ids: readonly string[]): Promise<Person[]> {
  if (ids.length === 0) return []
  return db.selectFrom("user").select(["id", "name"]).where("id", "in", [...ids]).execute()
}

/** Candidate people to mention (id + name only), alphabetical, capped. */
export async function listPeople(db: Db, limit: number): Promise<Person[]> {
  return db.selectFrom("user").select(["id", "name"]).orderBy("name", "asc").limit(limit).execute()
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" }

/** Deletes one comment of THAT record if the viewer is its author or a moderator. */
export async function deleteCommentWith(
  db: Db,
  viewer: Viewer,
  entity: string,
  entityId: string,
  commentId: string
): Promise<DeleteResult> {
  return db.transaction().execute(async (trx) => {
    const c = await trx
      .selectFrom("comments")
      .select(["id", "author_id"])
      .where("id", "=", commentId)
      .where("entity", "=", entity)
      .where("entity_id", "=", entityId)
      .forUpdate()
      .executeTakeFirst()
    if (!c) return { ok: false as const, reason: "not_found" as const }
    if (!canDeleteComment({ authorId: c.author_id }, viewer)) return { ok: false as const, reason: "forbidden" as const }
    await trx.deleteFrom("comments").where("id", "=", c.id).execute()
    return { ok: true as const }
  })
}

/** Cleanup when the host deletes the record. No permission check: host code. Returns how many were removed. */
export async function deleteCommentsForWith(db: Db, entity: string, entityId: string): Promise<number> {
  const res = await db.deleteFrom("comments").where("entity", "=", entity).where("entity_id", "=", entityId).executeTakeFirst()
  return Number(res.numDeletedRows ?? 0)
}
