import type { ArticleLocale } from "./input"

export type ArticleSummary = {
  id: string
  slug: string
  title: string
  summary: string | null
  category: string | null
  locale: ArticleLocale
  sortOrder: number
  updatedAt: Date
}

export type Article = ArticleSummary & {
  body: string
  published: boolean
  publishedAt: Date | null
}

/** Public URL of an article (`/ayuda/<slug>`), for other modules that link to it. */
export function helpArticleHref(slug: string): string {
  return `/ayuda/${encodeURIComponent(slug)}`
}
