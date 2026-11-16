/**
 * Categories and items, with the database injected (contracts/index.ts and the
 * pages pass `getKysely()`; the DB tests, their own). No session or permission
 * checks here: those belong to the caller (server/actions.ts, the pages, or
 * another module that calls the contract after checking its own).
 */
import { randomUUID } from "node:crypto"

import { sql, type Kysely, type Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import { slugify } from "../contracts/domain"
import type { ItemData } from "../contracts/input"
import type {
  Category,
  Item,
  ItemStatus,
  ItemWithStock,
  SellableItem,
} from "../contracts/types"
import type { CatalogCategoriesTable, CatalogItemsTable } from "../db/types"
import { insertMove, stockOf, withTransaction } from "./stock"

type Db = Kysely<Database>

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false
  if ((err as { code: unknown }).code !== "23505") return false
  if (!constraint) return true
  const c = (err as { constraint?: unknown }).constraint
  const detail = (err as { detail?: unknown }).detail
  return (
    c === constraint ||
    (typeof c === "string" && c.includes(constraint)) ||
    (typeof detail === "string" && detail.includes(`(${constraint.split("_").pop()})`))
  )
}

/** Escapes `%`, `_` and `\` for an ILIKE pattern. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

export function toCategory(r: Selectable<CatalogCategoriesTable>): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    position: r.position,
  }
}

export function toItem(r: Selectable<CatalogItemsTable>): Item {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    priceMinor: Number(r.price_minor),
    currency: r.currency,
    attributes: r.attributes ?? {},
    status: r.status,
    trackStock: r.track_stock,
    sku: r.sku,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ── categories ───────────────────────────────────────────────────────────────

export async function listCategories(db: Db): Promise<Category[]> {
  const rows = await db
    .selectFrom("catalog_categories")
    .selectAll()
    .orderBy("position", "asc")
    .orderBy("name", "asc")
    .execute()
  return rows.map(toCategory)
}

export async function getCategoryBySlug(db: Db, slug: string): Promise<Category | null> {
  const row = await db
    .selectFrom("catalog_categories")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst()
  return row ? toCategory(row) : null
}

export class SlugTakenError extends Error {
  constructor(readonly slug: string) {
    super(`catalog: el slug «${slug}» ya está en uso`)
    this.name = "SlugTakenError"
  }
}
export class SkuTakenError extends Error {
  constructor(readonly sku: string) {
    super(`catalog: el SKU «${sku}» ya está en uso`)
    this.name = "SkuTakenError"
  }
}

/**
 * Inserts with `slug`, or, when the caller left it empty, with one derived
 * from `name` — adding a short random suffix if that one is taken. An explicit
 * slug that is taken throws SlugTakenError.
 *
 * `insert` must use `on conflict (slug) do nothing` and resolve to undefined
 * when the slug is taken. It must NOT rely on catching a unique violation:
 * inside a transaction (createItem) a failed statement aborts the whole
 * transaction (25P02), so a retry after a caught error can never succeed.
 * A conflict on another unique column (sku) still throws, and aborts.
 */
async function withSlug<T>(
  name: string,
  explicit: string,
  fallback: string,
  insert: (slug: string) => Promise<T | undefined>
): Promise<T> {
  const base = explicit || slugify(name) || fallback
  const first = await insert(base)
  if (first !== undefined) return first
  if (explicit) throw new SlugTakenError(explicit)
  // Sequential on purpose: `insert` may run on a transaction's single connection.
  for (let attempt = 0; attempt < 3; attempt++) {
    const suffix = randomUUID().slice(0, 6)
    const row = await insert(`${base.slice(0, 80 - suffix.length - 1)}-${suffix}`)
    if (row !== undefined) return row
  }
  throw new SlugTakenError(base)
}

export async function createCategory(
  db: Db,
  input: { name: string; slug: string; description: string }
): Promise<Category> {
  const row = await withSlug(input.name, input.slug, "categoria", (slug) =>
    db
      .insertInto("catalog_categories")
      .values({
        id: randomUUID(),
        slug,
        name: input.name,
        description: input.description || null,
      })
      .onConflict((oc) => oc.column("slug").doNothing())
      .returningAll()
      .executeTakeFirst()
  )
  return toCategory(row)
}

// ── items ────────────────────────────────────────────────────────────────────

const itemValues = (d: ItemData) => ({
  name: d.name,
  description: d.description,
  category_id: d.categoryId,
  price_minor: d.priceMinor,
  currency: d.currency.toUpperCase(),
  attributes: JSON.stringify(d.attributes),
  status: d.status,
  track_stock: d.trackStock,
  sku: d.sku,
})

function rethrowSku(err: unknown, sku: string | null): never {
  if (sku && isUniqueViolation(err, "sku")) throw new SkuTakenError(sku)
  throw err
}

/** Creates an item and, if `initialStock > 0` and it tracks stock, its `initial` move — in one transaction. */
export async function createItem(
  db: Db,
  data: ItemData,
  opts: { initialStock?: number; createdBy?: string | null } = {}
): Promise<Item> {
  const createdBy = opts.createdBy ?? null
  try {
    return await withTransaction(db, async (trx) => {
      const row = await withSlug(data.name, data.slug, "producto", (slug) =>
        trx
          .insertInto("catalog_items")
          .values({ id: randomUUID(), slug, created_by: createdBy, ...itemValues(data) })
          .onConflict((oc) => oc.column("slug").doNothing())
          .returningAll()
          .executeTakeFirst()
      )
      const initial = opts.initialStock ?? 0
      if (initial > 0 && row.track_stock)
        await insertMove(trx, {
          itemId: row.id,
          qty: initial,
          reason: "initial",
          ref: null,
          note: null,
          createdBy,
        })
      return toItem(row)
    })
  } catch (err) {
    rethrowSku(err, data.sku)
  }
}

/** null if the item does not exist. The slug only changes when `data.slug` is not empty. */
export async function updateItem(db: Db, id: string, data: ItemData): Promise<Item | null> {
  try {
    const row = await db
      .updateTable("catalog_items")
      .set({
        ...itemValues(data),
        ...(data.slug ? { slug: data.slug } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
    return row ? toItem(row) : null
  } catch (err) {
    if (data.slug && isUniqueViolation(err, "slug")) throw new SlugTakenError(data.slug)
    rethrowSku(err, data.sku)
  }
}

export async function getItem(db: Db, id: string): Promise<ItemWithStock | null> {
  const row = await db
    .selectFrom("catalog_items")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()
  if (!row) return null
  const item = toItem(row)
  return { ...item, stock: item.trackStock ? await stockOf(db, item.id) : null }
}

/** Public lookup: only `active` items. */
export async function getActiveItemBySlug(db: Db, slug: string): Promise<ItemWithStock | null> {
  const row = await db
    .selectFrom("catalog_items")
    .selectAll()
    .where("slug", "=", slug)
    .where("status", "=", "active")
    .executeTakeFirst()
  if (!row) return null
  const item = toItem(row)
  return { ...item, stock: item.trackStock ? await stockOf(db, item.id) : null }
}

export type ListItemsFilter = {
  q?: string
  status?: ItemStatus | "all"
  categoryId?: string
  limit?: number
}

/** Items with their stock in ONE query (sum of moves joined by item). Sorted by name. */
export async function listItems(db: Db, filter: ListItemsFilter = {}): Promise<ItemWithStock[]> {
  let query = db
    .selectFrom("catalog_items as i")
    .leftJoin(
      db
        .selectFrom("catalog_stock_moves")
        .select(["item_id", sql<string>`sum(qty)`.as("total")])
        .groupBy("item_id")
        .as("s"),
      "s.item_id",
      "i.id"
    )
    .selectAll("i")
    .select(sql<string | null>`s.total`.as("stock_total"))
  if (filter.status && filter.status !== "all") query = query.where("i.status", "=", filter.status)
  if (filter.categoryId) query = query.where("i.category_id", "=", filter.categoryId)
  const q = filter.q?.trim()
  if (q)
    query = query.where((eb) =>
      eb.or([
        eb("i.name", "ilike", likePattern(q)),
        eb("i.sku", "ilike", likePattern(q)),
      ])
    )
  const rows = await query
    .orderBy("i.name", "asc")
    .orderBy("i.id", "asc")
    .limit(Math.min(Math.max(filter.limit ?? 200, 1), 500))
    .execute()
  return rows.map(({ stock_total, ...r }) => {
    const item = toItem(r)
    return { ...item, stock: item.trackStock ? Number(stock_total ?? 0) : null }
  })
}

/** The sellable view of active items (missing or non-active ids are left out). */
export async function getSellableItems(db: Db, ids: readonly string[]): Promise<SellableItem[]> {
  const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id.length > 0)
  if (unique.length === 0) return []
  const items = await listItemsByIds(db, unique)
  return items
    .filter((i) => i.status === "active")
    .map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      sku: i.sku,
      priceMinor: i.priceMinor,
      currency: i.currency,
      trackStock: i.trackStock,
      available: i.stock,
    }))
}

async function listItemsByIds(db: Db, ids: string[]): Promise<ItemWithStock[]> {
  const rows = await db
    .selectFrom("catalog_items as i")
    .leftJoin(
      db
        .selectFrom("catalog_stock_moves")
        .select(["item_id", sql<string>`sum(qty)`.as("total")])
        .where("item_id", "in", ids)
        .groupBy("item_id")
        .as("s"),
      "s.item_id",
      "i.id"
    )
    .selectAll("i")
    .select(sql<string | null>`s.total`.as("stock_total"))
    .where("i.id", "in", ids)
    .execute()
  return rows.map(({ stock_total, ...r }) => {
    const item = toItem(r)
    return { ...item, stock: item.trackStock ? Number(stock_total ?? 0) : null }
  })
}
