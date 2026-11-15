/**
 * Types, constants and errors of `catalog`. Pure: no server or client APIs, so
 * a server action, a client component, a test and another module can all
 * import it.
 */

/** `draft`: only staff sees it. `active`: public and sellable. `archived`: hidden, kept for history. */
export const ITEM_STATUSES = ["draft", "active", "archived"] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/**
 * Why the stock changed. Stock is ALWAYS the sum of `qty` of the moves of an
 * item; there is no editable stock number.
 * - `initial`       — stock entered when the product was created (> 0).
 * - `restock`       — goods received (> 0).
 * - `adjustment`    — manual correction: count, breakage, loss (≠ 0).
 * - `sale`          — taken by a checkout (`reserveStock`, < 0).
 * - `sale_reverted` — given back by `releaseStock` (> 0), same `ref` as the sale.
 */
export const MOVE_REASONS = [
  "initial",
  "restock",
  "adjustment",
  "sale",
  "sale_reverted",
] as const
export type MoveReason = (typeof MOVE_REASONS)[number]

/** Reasons a person can pick in the stock form. */
export const MANUAL_MOVE_REASONS = ["restock", "adjustment"] as const
export type ManualMoveReason = (typeof MANUAL_MOVE_REASONS)[number]

/** Currencies offered by the product form (any ISO 4217 code works in the contract). */
export const CURRENCIES = ["CLP", "USD", "EUR", "MXN", "ARS", "PEN", "COP"] as const
export type Currency = (typeof CURRENCIES)[number]
export const DEFAULT_CURRENCY: Currency = "CLP"

/** `entity` of a product photo in `storage` (`listFilesFor(CATALOG_PHOTO_ENTITY, item.id)`). */
export const CATALOG_PHOTO_ENTITY = "catalog_item"

/** Largest quantity in a single line or move. */
export const MAX_QTY = 100_000

/** Free attributes of a product: `{ "Color": "Rojo", "Peso (g)": 500, "Vegano": true }`. */
export type AttributeValue = string | number | boolean
export type Attributes = Record<string, AttributeValue>

export type Category = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
}

export type Item = {
  id: string
  slug: string
  name: string
  description: string | null
  categoryId: string | null
  /** Integer in the currency's minor unit (CLP 1990 → 1990; USD 15.50 → 1550). */
  priceMinor: number
  /** ISO 4217, upper case. */
  currency: string
  attributes: Attributes
  status: ItemStatus
  /** false: a service or a digital good; no stock, never "sold out". */
  trackStock: boolean
  sku: string | null
  createdAt: Date
  updatedAt: Date
}

/** An item with its current stock (null when it does not track stock). */
export type ItemWithStock = Item & { stock: number | null }

/**
 * What a checkout needs from a product. Only `active` items are sellable.
 * `available` is the stock at read time (null = not tracked = unlimited); it
 * is a hint for the UI, the guarantee is `reserveStock`.
 */
export type SellableItem = {
  id: string
  slug: string
  name: string
  sku: string | null
  priceMinor: number
  currency: string
  trackStock: boolean
  available: number | null
}

export type StockMove = {
  id: string
  itemId: string
  /** Signed: negative takes stock out. */
  qty: number
  reason: MoveReason
  /** Who caused it outside the catalog, e.g. "order:ord_42". */
  ref: string | null
  note: string | null
  createdBy: string | null
  createdAt: Date
}

/** One line of a reservation. The same item may repeat; quantities are added. */
export type StockLine = { itemId: string; qty: number }

export type ReserveResult = {
  /** `applied`: stock taken now. `already_applied`: this `ref` had already taken it (no change). */
  status: "applied" | "already_applied"
  /** The `sale` moves of this `ref` (none for items that do not track stock). */
  moves: StockMove[]
}

export type ReleaseResult = {
  /** `released`: stock given back now. `already_released`: it was. `nothing`: the ref took no stock. */
  status: "released" | "already_released" | "nothing"
  moves: StockMove[]
}

export const STOCK_ERROR_CODES = [
  "invalid_input",
  "item_not_found",
  "item_unavailable",
  "insufficient_stock",
  "already_released",
] as const
export type StockErrorCode = (typeof STOCK_ERROR_CODES)[number]

/**
 * Thrown by the stock operations. Inside a transaction a throw rolls back
 * everything the caller did in it too (that is the point: an order and its
 * stock are all-or-nothing).
 */
export class StockError extends Error {
  constructor(
    readonly code: StockErrorCode,
    detail: string,
    readonly itemId?: string,
    /** For `insufficient_stock`: what was left and what was asked. */
    readonly available?: number,
    readonly requested?: number
  ) {
    super(detail)
    this.name = "StockError"
  }
}
