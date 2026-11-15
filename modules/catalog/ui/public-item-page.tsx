import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { SLUG, formatAttributeValue } from "../contracts/domain"
import { es } from "../messages"
import { listPhotos } from "../server/photos"
import { getActiveItemBySlug } from "../server/store"
import { asLocale, formatMoney } from "./format"

/**
 * /productos/[slug] — public product page (active products only; anything
 * else is a 404). No buy button here: the `orders` module adds the cart.
 */
export default async function PublicItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG.test(slug) || slug.length > 80) notFound()
  const item = await getActiveItemBySlug(getKysely(), slug)
  if (!item) notFound()
  const [copy, locale, photos] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    listPhotos(item.id),
  ])
  const attributes = Object.entries(item.attributes)
  const availability =
    item.stock === null
      ? copy.public.available
      : item.stock <= 0
        ? copy.stock.out
        : copy.public.inStock(item.stock)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Link href="/productos" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
        {copy.public.back}
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {photos.length === 0 ? (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              {copy.public.noPhoto}
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/storage */}
              <img
                src={photos[0].url}
                alt={copy.photos.coverAlt(item.name)}
                className="aspect-square w-full rounded-xl border border-border object-cover"
              />
              {photos.length > 1 ? (
                <ul className="grid grid-cols-4 gap-2">
                  {photos.slice(1).map((p, i) => (
                    <li key={p.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/storage */}
                      <img
                        src={p.url}
                        alt={copy.photos.alt(item.name, i + 2)}
                        loading="lazy"
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <p className="text-xl font-semibold tabular-nums">{formatMoney(item.priceMinor, item.currency, locale)}</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {availability}
          </p>
          {item.description ? <p className="text-sm leading-relaxed whitespace-pre-line">{item.description}</p> : null}
          {attributes.length > 0 ? (
            <section aria-labelledby="catalog-attributes" className="flex flex-col gap-2">
              <h2 id="catalog-attributes" className="text-base font-semibold">
                {copy.public.attributes}
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {attributes.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{formatAttributeValue(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  )
}
