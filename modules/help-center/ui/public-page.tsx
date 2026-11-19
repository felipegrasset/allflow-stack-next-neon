import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { groupByCategory, normalizeQuery } from "../contracts/search"
import { es } from "../messages"
import { listPublishedForLocale } from "../server/queries"
import { activeLocale } from "./locale"

type SearchParams = Promise<{ q?: string | string[]; category?: string | string[] }>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

const href = (q: string, category: string) => {
  const p = new URLSearchParams()
  if (q) p.set("q", q)
  if (category) p.set("category", category)
  const s = p.toString()
  return s ? `/ayuda?${s}` : "/ayuda"
}

const chip =
  "inline-flex items-center rounded-full border border-border px-3 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"

/** /ayuda — public. Search (GET ?q=), categories (?category=) and the published articles. */
export default async function HelpCenterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = normalizeQuery(one(sp.q))
  const category = one(sp.category).trim().slice(0, 60)
  const [copy, locale] = await Promise.all([getModuleCopy(es), activeLocale()])
  const { items: found, fallback } = await listPublishedForLocale(locale, q)
  const categories = groupByCategory(found, copy.public.uncategorized).map((g) => g.category)
  const visible = category ? found.filter((a) => (a.category?.trim() || copy.public.uncategorized) === category) : found
  const groups = groupByCategory(visible, copy.public.uncategorized)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy.public.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.public.subtitle}</p>
      </div>

      <form role="search" method="get" action="/ayuda" className="flex gap-2">
        <label htmlFor="hc-q" className="sr-only">
          {copy.public.searchLabel}
        </label>
        <Input id="hc-q" name="q" type="search" defaultValue={q} maxLength={100} placeholder={copy.public.searchPlaceholder} />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <Button type="submit">{copy.public.searchSubmit}</Button>
      </form>

      {fallback ? <p className="text-xs text-muted-foreground">{copy.public.fallbackNotice}</p> : null}

      {categories.length > 1 ? (
        <nav aria-label={copy.public.categoriesLabel} className="flex flex-wrap gap-2">
          <Link href={href(q, "")} className={chip} aria-current={category ? undefined : "true"}>
            {copy.public.allCategories}
          </Link>
          {categories.map((c) => (
            <Link key={c} href={href(q, c)} className={chip} aria-current={c === category ? "true" : undefined}>
              {c}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {copy.public.count(visible.length)}
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">{q || category ? copy.public.noResults : copy.public.empty}</p>
          {q || category ? (
            <>
              <p className="text-sm text-muted-foreground">{copy.public.noResultsHint}</p>
              <Link href="/ayuda" className="text-sm text-primary underline-offset-4 hover:underline">
                {copy.public.clear}
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="flex flex-col gap-2" aria-label={g.category}>
            <h2 className="text-base font-medium">{g.category}</h2>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {g.items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/ayuda/${encodeURIComponent(a.slug)}`}
                    className="flex flex-col gap-0.5 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="text-sm font-medium">{a.title}</span>
                    {a.summary ? <span className="text-sm text-muted-foreground">{a.summary}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
