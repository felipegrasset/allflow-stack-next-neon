import { randomUUID } from "node:crypto"

import { sql, type Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"

import type { ArticleInput } from "../contracts/input"
import "../db/types"

type Db = Kysely<Database>

/** No permission checks here: the Server Actions (actions.ts) make them. */

const nullIfEmpty = (s: string): string | null => (s.trim() === "" ? null : s.trim())

/** Postgres unique_violation. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505"
}

export async function createArticle(input: ArticleInput, authorId: string | null, db: Db = getKysely()): Promise<string> {
  const id = randomUUID()
  await db
    .insertInto("help_center_articles")
    .values({
      id,
      slug: input.slug,
      title: input.title,
      summary: nullIfEmpty(input.summary),
      body: input.body,
      category: nullIfEmpty(input.category),
      locale: input.locale,
      sort_order: input.sortOrder,
      published: input.published,
      published_at: input.published ? sql<Date>`now()` : null,
      author_id: authorId,
    })
    .execute()
  return id
}

/** false when the article does not exist. publishedAt keeps its first value while the article stays published. */
export async function updateArticle(id: string, input: ArticleInput, db: Db = getKysely()): Promise<boolean> {
  const res = await db
    .updateTable("help_center_articles")
    .set({
      slug: input.slug,
      title: input.title,
      summary: nullIfEmpty(input.summary),
      body: input.body,
      category: nullIfEmpty(input.category),
      locale: input.locale,
      sort_order: input.sortOrder,
      published: input.published,
      published_at: input.published ? sql<Date>`coalesce(published_at, now())` : null,
      updated_at: sql<Date>`now()`,
    })
    .where("id", "=", id)
    .executeTakeFirst()
  return Number(res.numUpdatedRows) > 0
}

export async function setPublished(id: string, published: boolean, db: Db = getKysely()): Promise<boolean> {
  const res = await db
    .updateTable("help_center_articles")
    .set({
      published,
      published_at: published ? sql<Date>`coalesce(published_at, now())` : null,
      updated_at: sql<Date>`now()`,
    })
    .where("id", "=", id)
    .executeTakeFirst()
  return Number(res.numUpdatedRows) > 0
}

/** Deletes the article and (cascade) its ratings. */
export async function deleteArticle(id: string, db: Db = getKysely()): Promise<boolean> {
  const res = await db.deleteFrom("help_center_articles").where("id", "=", id).executeTakeFirst()
  return Number(res.numDeletedRows) > 0
}

/**
 * One rating per visitor and article: voting again replaces the previous one.
 * Only PUBLISHED articles take ratings; returns false for any other slug.
 */
export async function recordFeedback(
  input: { slug: string; voterHash: string; helpful: boolean; comment: string },
  db: Db = getKysely()
): Promise<boolean> {
  const article = await db
    .selectFrom("help_center_articles")
    .select("id")
    .where("slug", "=", input.slug)
    .where("published", "=", true)
    .executeTakeFirst()
  if (!article) return false
  await db
    .insertInto("help_center_feedback")
    .values({
      id: randomUUID(),
      article_id: article.id,
      voter_hash: input.voterHash,
      helpful: input.helpful,
      comment: nullIfEmpty(input.comment),
    })
    .onConflict((oc) =>
      oc.columns(["article_id", "voter_hash"]).doUpdateSet({
        helpful: input.helpful,
        comment: nullIfEmpty(input.comment),
        updated_at: sql<Date>`now()`,
      })
    )
    .execute()
  return true
}
