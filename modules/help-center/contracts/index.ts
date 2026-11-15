/**
 * The only thing another module may import from `help-center`:
 *
 *   import { getPublishedArticle, searchPublishedArticles, helpArticleHref } from "@/modules/help-center/contracts"
 *
 *   const hits = await searchPublishedArticles("contraseña", { locale: "es" })   // ArticleSummary[]
 *   const a = await getPublishedArticle("como-cambiar-tu-contrasena")           // Article | null
 *   <Link href={helpArticleHref(a.slug)}>{a.title}</Link>
 *
 * The readers are server-only and return PUBLISHED articles only; they do no
 * permission check (the content is public). The markdown parser, `slugify`
 * and the schemas are pure.
 */
export { getPublishedArticle, listPublishedArticles, searchPublishedArticles } from "../server/api"
export { parseBody, parseInline, safeHref, toPlainText, type Block, type Inline } from "./markdown"
export { ARTICLE_LOCALES, articleSchemas, slugify, type ArticleInput, type ArticleLocale } from "./input"
export { groupByCategory, matchRank, rankArticles } from "./search"
export { helpArticleHref, type Article, type ArticleSummary } from "./types"
