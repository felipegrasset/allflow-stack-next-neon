/**
 * Pure rules of `catalog` (no `@/` imports, no database): slugs, attributes,
 * and the stock arithmetic that server/stock.ts applies under a row lock.
 * Tested without a database in tests/catalog.test.ts.
 */
import {
  MAX_QTY,
  StockError,
  type AttributeValue,
  type Attributes,
  type ItemStatus,
  type StockLine,
} from "./types"

// ── slugs ────────────────────────────────────────────────────────────────────

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_SLUG = 80

/** "Café de Grano 1 kg" → "cafe-de-grano-1-kg". "" when nothing usable is left. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "")
}

// ── references (who took the stock) ──────────────────────────────────────────

/** "order:ord_42", "pos-2026-11-15-7". Letters, digits and `_.:-`, up to 200. */
export const REF = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/
export const isRef = (v: unknown): v is string => typeof v === "string" && REF.test(v)

// ── attributes ───────────────────────────────────────────────────────────────

export const MAX_ATTRIBUTES = 30
export const MAX_ATTRIBUTE_KEY = 60
export const MAX_ATTRIBUTE_VALUE = 200

export type AttributesIssue =
  | { kind: "not_object" }
  | { kind: "too_many" }
  | { kind: "bad_key"; key: string }
  | { kind: "bad_value"; key: string }

/**
 * Validates the free attributes stored in `catalog_items.attributes` (jsonb).
 * A flat object; keys 1–60 chars without control characters; values a string
 * (≤ 200), a finite number or a boolean. Returns null when valid.
 */
export function checkAttributes(value: unknown): AttributesIssue | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { kind: "not_object" }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_ATTRIBUTES) return { kind: "too_many" }
  for (const [key, v] of entries) {
    if (
      key.trim() !== key ||
      key.length === 0 ||
      key.length > MAX_ATTRIBUTE_KEY ||
      /[\u0000-\u001f\u007f]/.test(key)
    )
      return { kind: "bad_key", key }
    const ok =
      (typeof v === "string" && v.length <= MAX_ATTRIBUTE_VALUE) ||
      (typeof v === "number" && Number.isFinite(v)) ||
      typeof v === "boolean"
    if (!ok) return { kind: "bad_value", key }
  }
  return null
}

export const isAttributes = (value: unknown): value is Attributes =>
  checkAttributes(value) === null

/**
 * The product form writes attributes as text, one per line: `Color: Rojo`.
 * Empty lines are skipped; the first `:` splits key and value; both are
 * trimmed; values stay strings (the form does not guess types). A repeated key
 * keeps the last value. Returns null when a non-empty line has no `:`, an empty
 * key or an empty value — the caller turns that into a field error.
 */
export function parseAttributeLines(text: string): Attributes | null {
  const out: Attributes = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const i = line.indexOf(":")
    if (i <= 0) return null
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (!key || !value) return null
    out[key] = value
  }
  return out
}

/** Attributes → the text the form shows back (`Clave: valor` per line). */
export function formatAttributeLines(attributes: Attributes): string {
  return Object.entries(attributes)
    .map(([k, v]) => `${k}: ${formatAttributeValue(v)}`)
    .join("\n")
}

export function formatAttributeValue(v: AttributeValue): string {
  return typeof v === "boolean" ? (v ? "✓" : "✗") : String(v)
}

// ── stock arithmetic ─────────────────────────────────────────────────────────

export const isQty = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= MAX_QTY

/** Joins repeated items and validates quantities. Sorted by item id (the lock order). */
export function mergeLines(lines: readonly StockLine[]): StockLine[] {
  if (lines.length === 0)
    throw new StockError("invalid_input", "catalog: una reserva necesita al menos una línea")
  const sums = new Map<string, number>()
  for (const l of lines) {
    if (typeof l.itemId !== "string" || l.itemId.length === 0 || l.itemId.length > 100)
      throw new StockError("invalid_input", "catalog: itemId inválido")
    if (!isQty(l.qty))
      throw new StockError("invalid_input", `catalog: cantidad inválida (${String(l.qty)})`, l.itemId)
    sums.set(l.itemId, (sums.get(l.itemId) ?? 0) + l.qty)
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([itemId, qty]) => {
      if (qty > MAX_QTY)
        throw new StockError("invalid_input", `catalog: cantidad inválida (${qty})`, itemId)
      return { itemId, qty }
    })
}

/** What the lock returned for one item: its state and its current stock. */
export type StockSnapshot = {
  status: ItemStatus
  trackStock: boolean
  /** Sum of its moves. */
  stock: number
}

/**
 * Decides a reservation from a snapshot taken UNDER LOCK. All-or-nothing:
 * throws StockError on the first line that cannot be served (unknown item,
 * not `active`, or not enough stock). Returns the `sale` moves to insert
 * (negative quantities), skipping items that do not track stock.
 */
export function planReservation(
  lines: readonly StockLine[],
  snapshot: ReadonlyMap<string, StockSnapshot>
): StockLine[] {
  const moves: StockLine[] = []
  for (const line of mergeLines(lines)) {
    const s = snapshot.get(line.itemId)
    if (!s) throw new StockError("item_not_found", "catalog: el producto no existe", line.itemId)
    if (s.status !== "active")
      throw new StockError("item_unavailable", "catalog: el producto no está a la venta", line.itemId)
    if (!s.trackStock) continue
    if (s.stock < line.qty)
      throw new StockError(
        "insufficient_stock",
        `catalog: stock insuficiente (quedan ${s.stock}, se piden ${line.qty})`,
        line.itemId,
        Math.max(0, s.stock),
        line.qty
      )
    moves.push({ itemId: line.itemId, qty: -line.qty })
  }
  return moves
}

/**
 * Given the `sale` moves of a ref and the items that already have their
 * `sale_reverted`, the compensating moves still missing (positive).
 */
export function planRelease(
  sales: readonly { itemId: string; qty: number }[],
  revertedItemIds: ReadonlySet<string>
): StockLine[] {
  return sales
    .filter((s) => !revertedItemIds.has(s.itemId))
    .map((s) => ({ itemId: s.itemId, qty: -s.qty }))
    .sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0))
}

/**
 * A manual move (restock or adjustment) from the current stock. `restock`
 * must add; an `adjustment` may add or remove but never leave stock below 0.
 */
export function checkManualMove(
  reason: "initial" | "restock" | "adjustment",
  qty: number,
  current: number
): void {
  if (!Number.isSafeInteger(qty) || qty === 0 || Math.abs(qty) > MAX_QTY)
    throw new StockError("invalid_input", `catalog: cantidad inválida (${qty})`)
  if (reason !== "adjustment" && qty < 0)
    throw new StockError("invalid_input", "catalog: una reposición suma stock")
  if (current + qty < 0)
    throw new StockError(
      "insufficient_stock",
      `catalog: el ajuste dejaría el stock bajo cero (hay ${current})`,
      undefined,
      Math.max(0, current),
      -qty
    )
}
