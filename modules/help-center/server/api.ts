import type { ArticleLocale } from "../contracts/input"
import type { Article, ArticleSummary } from "../contracts/types"
import { getBySlug, listPublished } from "./queries"

/** Published articles, in the editor's order. Server-only; no permission check (public content). */
export function listPublishedArticles(opts: { locale?: ArticleLocale; limit?: number } = {}): Promise<ArticleSummary[]> {
  return listPublished(opts)
}

/** Published articles matching `q` (title, summary or body), best matches first. */
export function searchPublishedArticles(
  q: string,
  opts: { locale?: ArticleLocale; limit?: number } = {}
): Promise<ArticleSummary[]> {
  return listPublished({ ...opts, q })
}

/** One published article by slug, or null (drafts are never returned). */
export function getPublishedArticle(slug: string): Promise<Article | null> {
  return getBySlug(slug, { includeDrafts: false })
}
