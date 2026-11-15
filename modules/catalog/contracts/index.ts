/**
 * The only thing another module may import from `catalog` (server side).
 * Pure pieces (types, money, rules) are re-exported too; a client component
 * imports them from `@/modules/catalog/contracts/types` or `/money`.
 *
 *   import { getSellableItems, reserveStock, releaseStock, StockError } from "@/modules/catalog/contracts"
 *
 *   // checkout: prices come from HERE, never from the browser
 *   const items = await getSellableItems(cart.map((l) => l.itemId))
 *
 *   // order + stock, all-or-nothing, in the caller's transaction:
 *   await db.transaction().execute(async (trx) => {
 *     await trx.insertInto("orders_orders").values(…).execute()
 *     await reserveStock({ ref: `order:${orderId}`, lines }, { db: trx })  // throws StockError → rollback
 *   })
 *
 *   // cancelled / expired / payment rejected:
 *   await releaseStock({ ref: `order:${orderId}` })
 *
 * None of these check session or permission: they are for server code that
 * already checked its own (an order action, a webhook).
 */
import type { Kysely } from "kysely"

import { getKysely } from "@/server/db/pool"
import type { Database } from "@/server/db/schema"

import { listPhotos } from "../server/photos"
import * as stock from "../server/stock"
import * as store from "../server/store"
import type {
  Category,
  ItemWithStock,
  ReleaseResult,
  ReserveResult,
  SellableItem,
  StockLine,
  StockMove,
} from "./types"

/** Optional executor: pass your transaction (`trx`) to run inside it. */
export type CatalogDbOptions = { db?: Kysely<Database> }
const dbOf = (opts?: CatalogDbOptions) => opts?.db ?? getKysely()

/** One sellable item (only `active`), with price in minor units + currency and the stock at read time. */
export async function getSellableItem(
  itemId: string,
  opts?: CatalogDbOptions
): Promise<SellableItem | null> {
  const [item] = await store.getSellableItems(dbOf(opts), [itemId])
  return item ?? null
}

/** Several at once; missing or non-active ids are left out (compare lengths to detect them). */
export const getSellableItems = (
  itemIds: readonly string[],
  opts?: CatalogDbOptions
): Promise<SellableItem[]> => store.getSellableItems(dbOf(opts), itemIds)

/** Any item by id (any status), with its stock. For admin screens of other modules. */
export const getItem = (itemId: string, opts?: CatalogDbOptions): Promise<ItemWithStock | null> =>
  store.getItem(dbOf(opts), itemId)

/** Current stock (sum of moves). A reading, not a guarantee: use `reserveStock`. */
export const getStock = (itemId: string, opts?: CatalogDbOptions): Promise<number> =>
  stock.stockOf(dbOf(opts), itemId)

/**
 * Takes stock for `ref` (e.g. `order:<id>`), all lines or none, once per ref.
 * Throws StockError: `invalid_input`, `item_not_found`, `item_unavailable`,
 * `insufficient_stock` (with `itemId`, `available`, `requested`) or
 * `already_released`. Same ref again → `{ status: "already_applied" }`.
 */
export const reserveStock = (
  input: { ref: string; lines: readonly StockLine[]; createdBy?: string | null },
  opts?: CatalogDbOptions
): Promise<ReserveResult> => stock.reserveStock(dbOf(opts), input)

/** Gives back what `reserveStock(ref)` took. Idempotent. */
export const releaseStock = (
  input: { ref: string; createdBy?: string | null; note?: string | null },
  opts?: CatalogDbOptions
): Promise<ReleaseResult> => stock.releaseStock(dbOf(opts), input)

/** The stock moves of a reference (to show what an order took or gave back). */
export const listStockMovesByRef = (ref: string, opts?: CatalogDbOptions): Promise<StockMove[]> =>
  stock.listMovesByRef(dbOf(opts), ref)

export const listCategories = (opts?: CatalogDbOptions): Promise<Category[]> =>
  store.listCategories(dbOf(opts))

/** Photos of an item (`storage` files, public); `[0]` is the cover. `f.url` → /api/storage/<id>. */
export const listItemPhotos = (itemId: string) => listPhotos(itemId)

/** Public URL of an item's page. */
export const itemPublicPath = (slug: string) => `/productos/${slug}`

export {
  checkAttributes,
  isAttributes,
  isRef,
  mergeLines,
  planReservation,
  slugify,
} from "./domain"
export { currencyExponent, formatAmountInput, minorToMajor, parseAmount } from "./money"
export * from "./types"
