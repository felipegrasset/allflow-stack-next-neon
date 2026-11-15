/**
 * Stock: the only code that writes `catalog_stock_moves`.
 *
 * Stock is the sum of an item's moves. Every write that could lower it runs in
 * a transaction that first locks the item rows (`select … for update`, in id
 * order so two reservations never deadlock), then reads the sums, then decides
 * with the pure rules of contracts/domain.ts, then inserts. Two checkouts that
 * race for the last unit are serialised by the lock: the second sees the first
 * one's move and fails with `insufficient_stock`.
 *
 * Each function takes a `Kysely` that may be a transaction of the caller: then
 * it runs inside it (an order and its stock commit or roll back together);
 * otherwise it opens its own.
 */
import { randomUUID } from "node:crypto"

import { sql, type Kysely, type Selectable } from "kysely"

import type { Database } from "@/server/db/schema"

import {
  checkManualMove,
  isRef,
  mergeLines,
  planRelease,
  planReservation,
  type StockSnapshot,
} from "../contracts/domain"
import {
  StockError,
  type MoveReason,
  type ReleaseResult,
  type ReserveResult,
  type StockLine,
  type StockMove,
} from "../contracts/types"
import type { CatalogStockMovesTable } from "../db/types"

type Db = Kysely<Database>

/** Runs `fn` in the caller's transaction if `db` is one, else in a new one. */
export function withTransaction<T>(db: Db, fn: (trx: Db) => Promise<T>): Promise<T> {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn)
}

export function toMove(r: Selectable<CatalogStockMovesTable>): StockMove {
  return {
    id: r.id,
    itemId: r.item_id,
    qty: r.qty,
    reason: r.reason,
    ref: r.ref,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }
}

/** Current stock of one item (sum of its moves; 0 without moves). Not locked: a reading. */
export async function stockOf(db: Db, itemId: string): Promise<number> {
  const row = await db
    .selectFrom("catalog_stock_moves")
    .select(sql<string>`coalesce(sum(qty), 0)`.as("total"))
    .where("item_id", "=", itemId)
    .executeTakeFirst()
  return Number(row?.total ?? 0)
}

/** Locks the items (id order) and returns their snapshot. Must run inside a transaction. */
async function lockItems(trx: Db, ids: string[]): Promise<Map<string, StockSnapshot>> {
  const out = new Map<string, StockSnapshot>()
  if (ids.length === 0) return out
  const sorted = [...ids].sort()
  const items = await trx
    .selectFrom("catalog_items")
    .select(["id", "status", "track_stock"])
    .where("id", "in", sorted)
    .orderBy("id", "asc")
    .forUpdate()
    .execute()
  const sums = await trx
    .selectFrom("catalog_stock_moves")
    .select(["item_id", sql<string>`sum(qty)`.as("total")])
    .where("item_id", "in", sorted)
    .groupBy("item_id")
    .execute()
  const byItem = new Map(sums.map((s) => [s.item_id, Number(s.total)]))
  for (const i of items)
    out.set(i.id, { status: i.status, trackStock: i.track_stock, stock: byItem.get(i.id) ?? 0 })
  return out
}

export async function insertMove(
  trx: Db,
  m: {
    itemId: string
    qty: number
    reason: MoveReason
    ref: string | null
    note: string | null
    createdBy: string | null
  }
): Promise<StockMove> {
  const row = await trx
    .insertInto("catalog_stock_moves")
    .values({
      id: randomUUID(),
      item_id: m.itemId,
      qty: m.qty,
      reason: m.reason,
      ref: m.ref,
      note: m.note,
      created_by: m.createdBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return toMove(row)
}

/** Latest moves of an item, newest first. */
export async function listMoves(db: Db, itemId: string, limit = 50): Promise<StockMove[]> {
  const rows = await db
    .selectFrom("catalog_stock_moves")
    .selectAll()
    .where("item_id", "=", itemId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(Math.min(Math.max(limit, 1), 200))
    .execute()
  return rows.map(toMove)
}

/** The moves of a reference (all items), oldest first. */
export async function listMovesByRef(db: Db, ref: string): Promise<StockMove[]> {
  if (!isRef(ref)) return []
  const rows = await db
    .selectFrom("catalog_stock_moves")
    .selectAll()
    .where("ref", "=", ref)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute()
  return rows.map(toMove)
}

/**
 * A manual move: `restock` (> 0) or `adjustment` (≠ 0, never below zero).
 * Throws StockError (`item_not_found`, `invalid_input`, `insufficient_stock`).
 * An item that does not track stock does not take moves (`invalid_input`).
 */
export async function adjustStock(
  db: Db,
  input: {
    itemId: string
    qty: number
    reason: "restock" | "adjustment"
    note?: string | null
    createdBy?: string | null
  }
): Promise<StockMove> {
  return withTransaction(db, async (trx) => {
    const snap = (await lockItems(trx, [input.itemId])).get(input.itemId)
    if (!snap) throw new StockError("item_not_found", "catalog: el producto no existe", input.itemId)
    if (!snap.trackStock)
      throw new StockError("invalid_input", "catalog: este producto no controla stock", input.itemId)
    checkManualMove(input.reason, input.qty, snap.stock)
    return insertMove(trx, {
      itemId: input.itemId,
      qty: input.qty,
      reason: input.reason,
      ref: null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    })
  })
}

/**
 * Takes the stock of a checkout, all-or-nothing, once per `ref`.
 * - Every line must be an `active` item with enough stock, else StockError
 *   (`item_not_found`, `item_unavailable`, `insufficient_stock`) and nothing
 *   is written.
 * - Repeating it with the same `ref` changes nothing (`already_applied`); after
 *   `releaseStock(ref)` it throws `already_released` (use a new ref).
 */
export async function reserveStock(
  db: Db,
  input: { ref: string; lines: readonly StockLine[]; createdBy?: string | null }
): Promise<ReserveResult> {
  if (!isRef(input.ref)) throw new StockError("invalid_input", "catalog: ref inválida")
  const lines = mergeLines(input.lines)
  return withTransaction(db, async (trx) => {
    const snapshot = await lockItems(trx, lines.map((l) => l.itemId))
    const previous = await trx
      .selectFrom("catalog_stock_moves")
      .selectAll()
      .where("ref", "=", input.ref)
      .where("reason", "in", ["sale", "sale_reverted"])
      .orderBy("item_id", "asc")
      .execute()
    if (previous.some((m) => m.reason === "sale_reverted"))
      throw new StockError("already_released", "catalog: esta referencia ya se liberó")
    if (previous.length > 0)
      return { status: "already_applied", moves: previous.map(toMove) }
    const planned = planReservation(lines, snapshot)
    const moves: StockMove[] = []
    for (const m of planned)
      moves.push(
        await insertMove(trx, {
          itemId: m.itemId,
          qty: m.qty,
          reason: "sale",
          ref: input.ref,
          note: null,
          createdBy: input.createdBy ?? null,
        })
      )
    return { status: "applied", moves }
  })
}

/**
 * Gives back what `reserveStock(ref)` took (a cancelled or expired order).
 * Idempotent: a second call returns `already_released` and writes nothing.
 * Works on archived items too (the units come back to the shelf).
 */
export async function releaseStock(
  db: Db,
  input: { ref: string; createdBy?: string | null; note?: string | null }
): Promise<ReleaseResult> {
  if (!isRef(input.ref)) throw new StockError("invalid_input", "catalog: ref inválida")
  return withTransaction(db, async (trx) => {
    const first = await trx
      .selectFrom("catalog_stock_moves")
      .select("item_id")
      .where("ref", "=", input.ref)
      .where("reason", "=", "sale")
      .execute()
    if (first.length === 0) return { status: "nothing", moves: [] }
    await lockItems(trx, first.map((m) => m.item_id))
    const all = await trx
      .selectFrom("catalog_stock_moves")
      .selectAll()
      .where("ref", "=", input.ref)
      .where("reason", "in", ["sale", "sale_reverted"])
      .execute()
    const sales = all.filter((m) => m.reason === "sale").map((m) => ({ itemId: m.item_id, qty: m.qty }))
    const reverted = new Set(all.filter((m) => m.reason === "sale_reverted").map((m) => m.item_id))
    const missing = planRelease(sales, reverted)
    if (missing.length === 0)
      return {
        status: "already_released",
        moves: all.filter((m) => m.reason === "sale_reverted").map(toMove),
      }
    const moves: StockMove[] = []
    for (const m of missing)
      moves.push(
        await insertMove(trx, {
          itemId: m.itemId,
          qty: m.qty,
          reason: "sale_reverted",
          ref: input.ref,
          note: input.note?.trim() || null,
          createdBy: input.createdBy ?? null,
        })
      )
    return { status: "released", moves }
  })
}
