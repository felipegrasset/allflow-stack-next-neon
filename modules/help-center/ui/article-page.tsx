import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { SLUG_RE } from "../contracts/input"
import { es } from "../messages"
import { can } from "../server/guard"
import { getBySlug } from "../server/queries"
import { FeedbackForm } from "./feedback-form"
import { activeLocale } from "./locale"
import { RichText } from "./rich-text"

const linkClass =
  "rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * /ayuda/[slug] — public for published articles. A draft is shown only to
 * someone with `article:read` (preview); everyone else gets a 404.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_RE.test(slug) || slug.length > 80) notFound()
  const [copy, locale, canPreview] = await Promise.all([getModuleCopy(es), activeLocale(), can("read")])
  const article = await getBySlug(slug, { includeDrafts: canPreview })
  if (!article) notFound()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/ayuda" className={linkClass}>
        {copy.public.back}
      </Link>
      <article className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          {article.category ? <p className="text-xs text-muted-foreground">{article.category}</p> : null}
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          {article.summary ? <p className="text-sm text-muted-foreground">{article.summary}</p> : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {article.published ? null : <Badge variant="outline">{copy.admin.unpublished}</Badge>}
            <time dateTime={article.updatedAt.toISOString()}>
              {copy.public.updated(formatDate(article.updatedAt, locale))}
            </time>
          </div>
          {article.published ? null : (
            <p className="text-sm text-muted-foreground" role="status">
              {copy.public.draftNotice}
            </p>
          )}
        </header>
        <RichText body={article.body} />
      </article>
      {article.published ? (
        <section className="border-t border-border pt-6">
          <FeedbackForm slug={article.slug} />
        </section>
      ) : null}
    </main>
  )
}
