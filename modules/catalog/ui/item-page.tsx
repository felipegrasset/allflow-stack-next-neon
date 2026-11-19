import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { es } from "../messages"
import { canItem, requirePagePermission } from "../server/guard"
import { listPhotos } from "../server/photos"
import { listMoves } from "../server/stock"
import { getItem, listCategories } from "../server/store"
import { asLocale, formatMoney } from "./format"
import { ItemForm } from "./item-form"
import { PhotosManager } from "./photos"
import { StatusBadge, StockBadge } from "./status-badge"
import { StockForm } from "./stock-form"

/** /catalog/[id] — a product: data, photos, stock and its moves. */
export default async function CatalogItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePagePermission(`/catalog/${id}`, "read")
  if (id.length > 100) notFound()
  const db = getKysely()
  const item = await getItem(db, id)
  if (!item) notFound()
  const [copy, locale, canWrite, categories, photos, moves] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    canItem("write"),
    listCategories(db),
    listPhotos(item.id),
    item.trackStock ? listMoves(db, item.id) : Promise.resolve([]),
  ])
  const stockLabels = { untracked: copy.stock.untracked, out: copy.stock.out, units: copy.stock.units }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/catalog" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {copy.item.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <StatusBadge status={item.status} label={copy.statuses[item.status]} />
          <StockBadge stock={item.stock} labels={stockLabels} />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMoney(item.priceMinor, item.currency, locale)}
          {item.sku ? ` · ${item.sku}` : ""}
        </p>
        {item.status === "active" ? (
          <ButtonLink href={`/productos/${item.slug}`} variant="outline" size="sm" className="self-start">
            {copy.item.viewPublic}
          </ButtonLink>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-labelledby="catalog-photos">
            <h2 id="catalog-photos" className="text-base font-semibold">
              {copy.photos.title}
            </h2>
            <PhotosManager
              itemId={item.id}
              itemName={item.name}
              photos={photos.map((p) => ({ id: p.id, url: p.url, name: p.name }))}
              canWrite={canWrite}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-labelledby="catalog-moves">
            <h2 id="catalog-moves" className="text-base font-semibold">
              {copy.stock.movesTitle}
            </h2>
            {!item.trackStock ? (
              <p className="text-sm text-muted-foreground">{copy.stock.untrackedHint}</p>
            ) : moves.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.stock.noMoves}</p>
            ) : (
              <ol className="flex flex-col divide-y divide-border">
                {moves.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                    <span className="flex flex-col">
                      <span className="font-medium">{copy.reasons[m.reason]}</span>
                      {m.note || m.ref ? (
                        <span className="text-xs text-muted-foreground">
                          {[m.ref, m.note].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-semibold tabular-nums">{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt, locale)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {item.trackStock && canWrite ? <StockForm itemId={item.id} /> : null}
          </section>
        </div>

        {canWrite ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-labelledby="catalog-edit">
            <h2 id="catalog-edit" className="text-base font-semibold">
              {copy.item.editTitle}
            </h2>
            <ItemForm item={item} categories={categories} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
