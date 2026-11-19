import Link from "next/link"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { ITEM_STATUSES, type ItemStatus } from "../contracts/types"
import { es } from "../messages"
import { canItem, requirePagePermission } from "../server/guard"
import { listCategories, listItems } from "../server/store"
import { CategoryForm } from "./category-form"
import { asLocale, formatMoney, one } from "./format"
import { ItemForm } from "./item-form"
import { StatusBadge, StockBadge } from "./status-badge"

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[] }>

const isStatus = (s: unknown): s is ItemStatus =>
  typeof s === "string" && (ITEM_STATUSES as readonly string[]).includes(s)

/** /catalog — staff list of products with stock; with `item:write`, new product and categories. */
export default async function CatalogAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("/catalog", "read")
  const sp = await searchParams
  const q = one(sp.q)?.trim().slice(0, 100) ?? ""
  const rawStatus = one(sp.status)
  const status = isStatus(rawStatus) ? rawStatus : "all"
  const db = getKysely()
  const [copy, items, categories, canWrite, locale] = await Promise.all([
    getModuleCopy(es),
    listItems(db, { q, status }),
    listCategories(db),
    canItem("write"),
    getLocale().then(asLocale),
  ])
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const stockLabels = { untracked: copy.stock.untracked, out: copy.stock.out, units: copy.stock.units }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.admin.subtitle}</p>
        </div>
        <ButtonLink href="/productos" variant="outline" size="sm">
          {copy.admin.publicLink}
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col gap-3" aria-label={copy.admin.listLabel}>
          <form role="search" method="get" className="flex flex-wrap gap-2">
            <label htmlFor="catalog-q" className="sr-only">
              {copy.admin.searchLabel}
            </label>
            <Input
              id="catalog-q"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={100}
              placeholder={copy.admin.searchPlaceholder}
              className="min-w-48 flex-1"
            />
            <label htmlFor="catalog-status" className="sr-only">
              {copy.fields.status}
            </label>
            <NativeSelect id="catalog-status" name="status" defaultValue={status}>
              <NativeSelectOption value="all">{copy.admin.allStatuses}</NativeSelectOption>
              {ITEM_STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {copy.statuses[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline">
              {copy.admin.searchSubmit}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {copy.admin.count(items.length)}
          </p>
          {items.length === 0 ? (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">
                {q || status !== "all" ? copy.admin.emptySearch : copy.admin.empty}
              </p>
              {!q && status === "all" && canWrite ? (
                <p className="text-sm text-muted-foreground">{copy.admin.emptyHint}</p>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.admin.columns.name}</TableHead>
                  <TableHead className="hidden md:table-cell">{copy.admin.columns.category}</TableHead>
                  <TableHead className="text-right">{copy.admin.columns.price}</TableHead>
                  <TableHead>{copy.admin.columns.stock}</TableHead>
                  <TableHead className="hidden sm:table-cell">{copy.admin.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <Link href={`/catalog/${i.id}`} className="underline-offset-2 hover:underline">
                        {i.name}
                      </Link>
                      {i.sku ? <span className="block text-xs text-muted-foreground">{i.sku}</span> : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {i.categoryId ? categoryName.get(i.categoryId) : copy.fields.noCategory}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(i.priceMinor, i.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <StockBadge stock={i.stock} labels={stockLabels} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={i.status} label={copy.statuses[i.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {canWrite ? (
            <section
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              aria-labelledby="catalog-new-item"
            >
              <h2 id="catalog-new-item" className="text-base font-semibold">
                {copy.admin.newTitle}
              </h2>
              <ItemForm categories={categories} />
            </section>
          ) : null}
          <section
            className="flex flex-col gap-3 rounded-xl border border-border p-4"
            aria-labelledby="catalog-categories"
          >
            <h2 id="catalog-categories" className="text-base font-semibold">
              {copy.categories.title}
            </h2>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.categories.empty}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <li key={c.id} className="rounded-full border border-border px-3 py-1 text-sm">
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? <CategoryForm /> : null}
          </section>
        </div>
      </div>
    </div>
  )
}
