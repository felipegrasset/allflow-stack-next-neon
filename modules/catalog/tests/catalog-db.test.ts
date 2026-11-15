/**
 * catalog against real Postgres: stock as the sum of moves, the last unit
 * under concurrency, all-or-nothing reservations, idempotent reserve/release,
 * running inside the caller's transaction, and slug/SKU uniqueness. Creates
 * its own schema (with a minimal "user" table) and drops it at the end.
 *
 * Skipped without DATABASE_URL — and says so.
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import type { ItemData } from "../contracts/input"
import { StockError } from "../contracts/types"
import { up } from "../db/migrations/0106_catalog_init"
import { adjustStock, releaseStock, reserveStock, stockOf } from "../server/stock"
import {
  SkuTakenError,
  createItem,
  getSellableItems,
  listItems,
  updateItem,
} from "../server/store"

const url = process.env.DATABASE_URL
const skip = url ? false : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `catalog_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 10 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}, public`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await pool.query(`create table "user" (id text primary key, name text not null)`)
  await pool.query(`insert into "user" (id, name) values ('ana', 'Ana Rojas')`)
  await up(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await db.destroy()
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`drop schema ${schema} cascade`)
  await admin.end()
})

const data = (over: Partial<ItemData> = {}): ItemData => ({
  name: "Café de grano",
  slug: "",
  description: null,
  priceMinor: 6990,
  currency: "CLP",
  categoryId: null,
  status: "active",
  trackStock: true,
  sku: null,
  attributes: { Origen: "Colombia" },
  ...over,
})

const code = (c: string) => (err: unknown) => err instanceof StockError && err.code === c

test("create with initial stock; stock is the sum of moves", { skip }, async () => {
  const item = await createItem(db, data(), { initialStock: 5, createdBy: "ana" })
  assert.equal(item.slug, "cafe-de-grano")
  assert.deepEqual(item.attributes, { Origen: "Colombia" })
  assert.equal(await stockOf(db, item.id), 5)
  await adjustStock(db, { itemId: item.id, qty: 3, reason: "restock" })
  await adjustStock(db, { itemId: item.id, qty: -2, reason: "adjustment", note: "rotura" })
  assert.equal(await stockOf(db, item.id), 6)
  await assert.rejects(
    adjustStock(db, { itemId: item.id, qty: -7, reason: "adjustment" }),
    code("insufficient_stock")
  )
  const [listed] = await listItems(db, { q: "café" })
  assert.equal(listed.stock, 6)
  // same name → derived slug gets a suffix
  const twin = await createItem(db, data())
  assert.match(twin.slug, /^cafe-de-grano-[0-9a-f]{6}$/)
})

test("the last unit: of ten concurrent checkouts exactly one wins", { skip }, async () => {
  const item = await createItem(db, data({ name: "Última unidad" }), { initialStock: 1 })
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      reserveStock(db, { ref: `order:race-${i}`, lines: [{ itemId: item.id, qty: 1 }] })
    )
  )
  const ok = results.filter((r) => r.status === "fulfilled")
  const failed = results.filter((r) => r.status === "rejected")
  assert.equal(ok.length, 1)
  for (const f of failed) assert.ok(code("insufficient_stock")((f as PromiseRejectedResult).reason))
  assert.equal(await stockOf(db, item.id), 0)
})

test("all-or-nothing, idempotent reserve, release once", { skip }, async () => {
  const a = await createItem(db, data({ name: "Aceite" }), { initialStock: 4 })
  const b = await createItem(db, data({ name: "Pan" }), { initialStock: 1 })
  const svc = await createItem(db, data({ name: "Despacho", trackStock: false }))

  await assert.rejects(
    reserveStock(db, { ref: "order:x1", lines: [{ itemId: a.id, qty: 2 }, { itemId: b.id, qty: 2 }] }),
    code("insufficient_stock")
  )
  assert.equal(await stockOf(db, a.id), 4, "nothing taken from a")

  const first = await reserveStock(db, {
    ref: "order:x2",
    lines: [{ itemId: a.id, qty: 2 }, { itemId: svc.id, qty: 1 }, { itemId: a.id, qty: 1 }],
  })
  assert.equal(first.status, "applied")
  assert.deepEqual(first.moves.map((m) => [m.itemId, m.qty]), [[a.id, -3]])
  const again = await reserveStock(db, { ref: "order:x2", lines: [{ itemId: a.id, qty: 3 }] })
  assert.equal(again.status, "already_applied")
  assert.equal(await stockOf(db, a.id), 1)

  const released = await releaseStock(db, { ref: "order:x2" })
  assert.equal(released.status, "released")
  assert.equal(await stockOf(db, a.id), 4)
  assert.equal((await releaseStock(db, { ref: "order:x2" })).status, "already_released")
  assert.equal(await stockOf(db, a.id), 4)
  assert.equal((await releaseStock(db, { ref: "order:none" })).status, "nothing")
  await assert.rejects(
    reserveStock(db, { ref: "order:x2", lines: [{ itemId: a.id, qty: 1 }] }),
    code("already_released")
  )

  await updateItem(db, b.id, data({ name: "Pan", status: "archived" }))
  await assert.rejects(
    reserveStock(db, { ref: "order:x3", lines: [{ itemId: b.id, qty: 1 }] }),
    code("item_unavailable")
  )
  const sellable = await getSellableItems(db, [a.id, b.id, "missing"])
  assert.deepEqual(sellable.map((s) => [s.id, s.priceMinor, s.currency, s.available]), [[a.id, 6990, "CLP", 4]])
})

test("inside the caller's transaction: a rollback gives the stock back", { skip }, async () => {
  const item = await createItem(db, data({ name: "Tazón" }), { initialStock: 2 })
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await reserveStock(trx, { ref: "order:rb", lines: [{ itemId: item.id, qty: 2 }] })
      throw new Error("the order insert failed")
    }),
    /the order insert failed/
  )
  assert.equal(await stockOf(db, item.id), 2)
})

test("SKU is unique", { skip }, async () => {
  await createItem(db, data({ name: "Uno", sku: "SKU-1" }))
  await assert.rejects(createItem(db, data({ name: "Dos", sku: "SKU-1" })), SkuTakenError)
})
