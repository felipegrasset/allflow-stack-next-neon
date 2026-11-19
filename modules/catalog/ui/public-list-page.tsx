import Link from "next/link"
import { getLocale } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { SLUG } from "../contracts/domain"
import { es } from "../messages"
import { coverPhotos } from "../server/photos"
import { getCategoryBySlug, listCategories, listItems } from "../server/store"
import { asLocale, formatMoney, one } from "./format"

type SearchParams = Promise<{ q?: string | string[]; categoria?: string | string[] }>

const PAGE = 60

/** /productos — public storefront: active products only, by category and search. No session needed. */
export default async function PublicCatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = one(sp.q)?.trim().slice(0, 100) ?? ""
  const rawCategory = one(sp.categoria) ?? ""
  const db = getKysely()
  const category = SLUG.test(rawCategory) ? await getCategoryBySlug(db, rawCategory) : null
  const [copy, locale, categories, items] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    listCategories(db),
    listItems(db, { q, status: "active", categoryId: category?.id, limit: PAGE }),
  ])
  const covers = await coverPhotos(items.map((i) => i.id))
  const href = (slug?: string) => {
    const p = new URLSearchParams()
    if (slug) p.set("categoria", slug)
    if (q) p.set("q", q)
    const s = p.toString()
    return s ? `/productos?${s}` : "/productos"
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{category ? category.name : copy.public.title}</h1>
        <p className="text-sm text-muted-foreground">{category?.description || copy.public.subtitle}</p>
      </div>

      <form role="search" method="get" className="flex gap-2">
        {category ? <input type="hidden" name="categoria" value={category.slug} /> : null}
        <label htmlFor="catalog-public-q" className="sr-only">
          {copy.public.searchLabel}
        </label>
        <Input
          id="catalog-public-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={100}
          placeholder={copy.public.searchPlaceholder}
        />
        <Button type="submit" variant="outline">
          {copy.public.searchSubmit}
        </Button>
      </form>

      {categories.length > 0 ? (
        <nav aria-label={copy.public.categoriesLabel}>
          <ul className="flex flex-wrap gap-2">
            {[{ slug: undefined, name: copy.public.allCategories }, ...categories].map((c) => {
              const current = (c.slug ?? null) === (category?.slug ?? null)
              return (
                <li key={c.slug ?? "all"}>
                  <Link
                    href={href(c.slug)}
                    aria-current={current ? "page" : undefined}
                    className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">{q ? copy.public.emptySearch(q) : copy.public.empty}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-label={copy.public.listLabel}>
          {items.map((i) => {
            const cover = covers.get(i.id)
            const soldOut = i.stock !== null && i.stock <= 0
            return (
              <li key={i.id}>
                <Link
                  href={`/productos/${i.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                    {cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- served by /api/storage */
                      <img src={cover.url} alt={i.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        {copy.public.noPhoto}
                      </span>
                    )}
                    {soldOut ? (
                      <span className="absolute top-2 left-2 rounded-full bg-background px-2 py-0.5 text-xs font-medium">
                        {copy.stock.out}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm leading-snug font-medium group-hover:underline">{i.name}</span>
                  <span className="mt-auto text-sm font-semibold tabular-nums">
                    {formatMoney(i.priceMinor, i.currency, locale)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {items.length === PAGE ? <p className="text-xs text-muted-foreground">{copy.public.truncated(PAGE)}</p> : null}
    </main>
  )
}
