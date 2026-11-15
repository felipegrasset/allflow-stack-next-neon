import type { Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"

import type { ArticleLocale } from "../contracts/input"
import { likePattern, normalizeQuery, rankArticles } from "../contracts/search"
import type { Article, ArticleSummary } from "../contracts/types"
import "../db/types"

type Db = Kysely<Database>

type SummaryRow = {
  id: string
  slug: string
  title: string
  summary: string | null
  category: string | null
  locale: string
  sort_order: number
  updated_at: Date
}

const asLocale = (l: string): ArticleLocale => (l === "en" ? "en" : "es")

function toSummary(r: SummaryRow): ArticleSummary {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    category: r.category,
    locale: asLocale(r.locale),
    sortOrder: Number(r.sort_order),
    updatedAt: new Date(r.updated_at),
  }
}

/** Upper bound of articles one public page loads. */
export const PUBLIC_LIMIT = 200

/** Published articles, optionally of one locale and matching a search text (title, summary or body). */
export async function listPublished(
  opts: { locale?: ArticleLocale; q?: string; limit?: number; db?: Db } = {}
): Promise<ArticleSummary[]> {
  const q = normalizeQuery(opts.q ?? "")
  let query = (opts.db ?? getKysely())
    .selectFrom("help_center_articles")
    .select(["id", "slug", "title", "summary", "category", "locale", "sort_order", "updated_at"])
    .where("published", "=", true)
  if (opts.locale) query = query.where("locale", "=", opts.locale)
  if (q) {
    const p = likePattern(q)
    query = query.where((eb) =>
      eb.or([eb("title", "ilike", p), eb("summary", "ilike", p), eb("body", "ilike", p)])
    )
  }
  const rows = await query
    .orderBy("sort_order", "asc")
    .orderBy("title", "asc")
    .limit(Math.min(opts.limit ?? PUBLIC_LIMIT, PUBLIC_LIMIT))
    .execute()
  return rankArticles(rows.map(toSummary), q)
}

/**
 * For the public page: the visitor's locale first; when it has nothing (a
 * Spanish-only help center seen in English), every locale, flagged `fallback`.
 */
export async function listPublishedForLocale(
  locale: ArticleLocale,
  q?: string
): Promise<{ items: ArticleSummary[]; fallback: boolean }> {
  const own = await listPublished({ locale, q })
  if (own.length > 0) return { items: own, fallback: false }
  const all = await listPublished({ q })
  return { items: all, fallback: all.length > 0 }
}

export async function getBySlug(slug: string, opts: { includeDrafts: boolean }): Promise<Article | null> {
  let query = getKysely()
    .selectFrom("help_center_articles")
    .selectAll()
    .where("slug", "=", slug)
  if (!opts.includeDrafts) query = query.where("published", "=", true)
  const r = await query.executeTakeFirst()
  return r ? { ...toSummary(r), body: r.body, published: r.published, publishedAt: r.published_at ? new Date(r.published_at) : null } : null
}

export type AdminRow = ArticleSummary & {
  published: boolean
  helpfulYes: number
  helpfulNo: number
}

/** Every article (drafts too) with its rating counts. */
export async function listForAdmin(limit = 500): Promise<AdminRow[]> {
  const rows = await getKysely()
    .selectFrom("help_center_articles as a")
    .select((eb) => [
      "a.id",
      "a.slug",
      "a.title",
      "a.summary",
      "a.category",
      "a.locale",
      "a.sort_order",
      "a.updated_at",
      "a.published",
      eb
        .selectFrom("help_center_feedback as f")
        .select((e) => e.fn.countAll().as("n"))
        .whereRef("f.article_id", "=", "a.id")
        .where("f.helpful", "=", true)
        .as("yes"),
      eb
        .selectFrom("help_center_feedback as f")
        .select((e) => e.fn.countAll().as("n"))
        .whereRef("f.article_id", "=", "a.id")
        .where("f.helpful", "=", false)
        .as("no"),
    ])
    .orderBy("a.category", "asc")
    .orderBy("a.sort_order", "asc")
    .orderBy("a.title", "asc")
    .limit(limit)
    .execute()
  return rows.map((r) => ({
    ...toSummary(r),
    published: r.published,
    helpfulYes: Number(r.yes ?? 0),
    helpfulNo: Number(r.no ?? 0),
  }))
}

export async function getForAdmin(id: string): Promise<Article | null> {
  const r = await getKysely().selectFrom("help_center_articles").selectAll().where("id", "=", id).executeTakeFirst()
  return r ? { ...toSummary(r), body: r.body, published: r.published, publishedAt: r.published_at ? new Date(r.published_at) : null } : null
}

export type FeedbackComment = { id: string; helpful: boolean; comment: string; createdAt: Date }

/** Latest ratings that carry a comment. The voter hash is never selected. */
export async function listFeedbackComments(articleId: string, limit = 10): Promise<FeedbackComment[]> {
  const rows = await getKysely()
    .selectFrom("help_center_feedback")
    .select(["id", "helpful", "comment", "created_at"])
    .where("article_id", "=", articleId)
    .where("comment", "is not", null)
    .orderBy("updated_at", "desc")
    .limit(limit)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    helpful: r.helpful,
    comment: r.comment ?? "",
    createdAt: new Date(r.created_at),
  }))
}
