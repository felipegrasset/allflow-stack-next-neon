/**
 * catalog v0.1 — what can be tested WITHOUT a database: slugs, attributes,
 * money, the stock arithmetic (reservation all-or-nothing, release, manual
 * moves), the Zod schemas, the catalog of texts, the manifest, and — reading
 * the code — that every Server Action checks session + permission before
 * writing and that stock writes happen under a row lock.
 * Pure imports only (relative), so it also runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  checkAttributes,
  checkManualMove,
  formatAttributeLines,
  isRef,
  mergeLines,
  parseAttributeLines,
  planRelease,
  planReservation,
  slugify,
  type StockSnapshot,
} from "../contracts/domain"
import { catalogSchemas, toItemData } from "../contracts/input"
import { formatAmountInput, parseAmount } from "../contracts/money"
import { MOVE_REASONS, StockError } from "../contracts/types"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(__dirname, "..")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

const stockError = (code: string) => (err: unknown) =>
  err instanceof StockError && err.code === code

// ── slugs, refs, attributes ──────────────────────────────────────────────────

test("slugify: accents, symbols and spaces", () => {
  assert.equal(slugify("Café de Grano 1 kg"), "cafe-de-grano-1-kg")
  assert.equal(slugify("  ¡Oferta!  Ñandú  "), "oferta-nandu")
  assert.equal(slugify("***"), "")
  assert.ok(slugify("a".repeat(200)).length <= 80)
})

test("isRef: order references", () => {
  assert.ok(isRef("order:ord_42"))
  assert.ok(isRef("pos-2026-11-15.7"))
  assert.ok(!isRef(""))
  assert.ok(!isRef("order 42"))
  assert.ok(!isRef(":x"))
  assert.ok(!isRef("x".repeat(201)))
})

test("attributes: flat object of string/number/boolean", () => {
  assert.equal(checkAttributes({ Color: "Rojo", Peso: 500, Vegano: true }), null)
  assert.equal(checkAttributes({}), null)
  assert.deepEqual(checkAttributes([]), { kind: "not_object" })
  assert.deepEqual(checkAttributes(null), { kind: "not_object" })
  assert.deepEqual(checkAttributes({ a: { b: 1 } }), { kind: "bad_value", key: "a" })
  assert.deepEqual(checkAttributes({ a: Number.NaN }), { kind: "bad_value", key: "a" })
  assert.deepEqual(checkAttributes({ " a": "x" }), { kind: "bad_key", key: " a" })
  const many = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`k${i}`, i]))
  assert.deepEqual(checkAttributes(many), { kind: "too_many" })
})

test("attribute lines: parse and format back", () => {
  assert.deepEqual(parseAttributeLines("Color: Rojo\n\n  Talla : M \r\nHora: 10:30"), {
    Color: "Rojo",
    Talla: "M",
    Hora: "10:30",
  })
  assert.deepEqual(parseAttributeLines(""), {})
  assert.equal(parseAttributeLines("sin dos puntos"), null)
  assert.equal(parseAttributeLines(": valor"), null)
  assert.equal(parseAttributeLines("Clave:"), null)
  assert.equal(formatAttributeLines({ Color: "Rojo", Peso: 500 }), "Color: Rojo\nPeso: 500")
})

// ── money ────────────────────────────────────────────────────────────────────

test("money: minor units without floats", () => {
  assert.equal(parseAmount("1.990", "CLP"), 1990)
  assert.equal(parseAmount("15,50", "USD"), 1550)
  assert.equal(parseAmount("0.1", "USD"), 10)
  assert.equal(parseAmount("-5", "CLP"), null)
  assert.equal(parseAmount("abc", "CLP"), null)
  assert.equal(formatAmountInput(1550, "USD"), "15.50")
  assert.equal(formatAmountInput(1990, "CLP"), "1990")
})

// ── stock arithmetic ─────────────────────────────────────────────────────────

const snap = (entries: [string, Partial<StockSnapshot>][]) =>
  new Map<string, StockSnapshot>(
    entries.map(([id, s]) => [id, { status: "active", trackStock: true, stock: 0, ...s }])
  )

test("mergeLines: joins repeated items, sorts by id, rejects bad quantities", () => {
  assert.deepEqual(
    mergeLines([
      { itemId: "b", qty: 1 },
      { itemId: "a", qty: 2 },
      { itemId: "b", qty: 3 },
    ]),
    [
      { itemId: "a", qty: 2 },
      { itemId: "b", qty: 4 },
    ]
  )
  assert.throws(() => mergeLines([]), stockError("invalid_input"))
  assert.throws(() => mergeLines([{ itemId: "a", qty: 0 }]), stockError("invalid_input"))
  assert.throws(() => mergeLines([{ itemId: "a", qty: 1.5 }]), stockError("invalid_input"))
  assert.throws(() => mergeLines([{ itemId: "a", qty: -1 }]), stockError("invalid_input"))
  assert.throws(() => mergeLines([{ itemId: "", qty: 1 }]), stockError("invalid_input"))
  assert.throws(
    () => mergeLines([{ itemId: "a", qty: 60_000 }, { itemId: "a", qty: 60_000 }]),
    stockError("invalid_input")
  )
})

test("planReservation: negative sale moves, untracked items skipped", () => {
  const moves = planReservation(
    [
      { itemId: "a", qty: 2 },
      { itemId: "svc", qty: 1 },
      { itemId: "a", qty: 1 },
    ],
    snap([
      ["a", { stock: 3 }],
      ["svc", { trackStock: false }],
    ])
  )
  assert.deepEqual(moves, [{ itemId: "a", qty: -3 }])
})

test("planReservation: all-or-nothing on the first failing line", () => {
  const s = snap([
    ["a", { stock: 5 }],
    ["b", { stock: 1 }],
    ["d", { status: "draft", stock: 9 }],
  ])
  assert.throws(
    () => planReservation([{ itemId: "a", qty: 1 }, { itemId: "b", qty: 2 }], s),
    (err: unknown) =>
      err instanceof StockError &&
      err.code === "insufficient_stock" &&
      err.itemId === "b" &&
      err.available === 1 &&
      err.requested === 2
  )
  assert.throws(() => planReservation([{ itemId: "zz", qty: 1 }], s), stockError("item_not_found"))
  assert.throws(() => planReservation([{ itemId: "d", qty: 1 }], s), stockError("item_unavailable"))
  // exactly the stock left is fine
  assert.deepEqual(planReservation([{ itemId: "b", qty: 1 }], s), [{ itemId: "b", qty: -1 }])
})

test("planRelease: only what is not reverted yet, positive", () => {
  const sales = [
    { itemId: "b", qty: -2 },
    { itemId: "a", qty: -1 },
  ]
  assert.deepEqual(planRelease(sales, new Set()), [
    { itemId: "a", qty: 1 },
    { itemId: "b", qty: 2 },
  ])
  assert.deepEqual(planRelease(sales, new Set(["a"])), [{ itemId: "b", qty: 2 }])
  assert.deepEqual(planRelease(sales, new Set(["a", "b"])), [])
})

test("checkManualMove: restock adds, adjustment never below zero", () => {
  checkManualMove("restock", 5, 0)
  checkManualMove("adjustment", -3, 3)
  checkManualMove("adjustment", 2, 0)
  assert.throws(() => checkManualMove("restock", -1, 10), stockError("invalid_input"))
  assert.throws(() => checkManualMove("adjustment", 0, 10), stockError("invalid_input"))
  assert.throws(() => checkManualMove("adjustment", -4, 3), stockError("insufficient_stock"))
})

// ── schemas ──────────────────────────────────────────────────────────────────

const item = {
  name: "Café de grano",
  slug: "",
  description: "",
  price: "6.990",
  currency: "CLP" as const,
  categoryId: "",
  status: "active" as const,
  trackStock: true,
  sku: "",
  attributes: "Origen: Colombia",
  initialStock: "10",
}

test("itemSchema → ItemData: price in minor units, attributes parsed", () => {
  const { itemSchema } = catalogSchemas()
  const parsed = itemSchema.parse(item)
  assert.deepEqual(toItemData(parsed), {
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
  })
})

test("itemSchema rejects bad price, slug, attributes and initial stock", () => {
  const { itemSchema } = catalogSchemas({ price: "P", slug: "S", attributes: "A", quantity: "Q" })
  const paths = (v: object) => {
    const r = itemSchema.safeParse({ ...item, ...v })
    return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`)
  }
  assert.deepEqual(paths({ price: "12 lucas" }), ["price:P"])
  assert.deepEqual(paths({ price: "15,505", currency: "USD" }), [])
  assert.deepEqual(paths({ slug: "Con Espacios" }), ["slug:S"])
  assert.deepEqual(paths({ attributes: "sin valor" }), ["attributes:A"])
  assert.deepEqual(paths({ initialStock: "-1" }), ["initialStock:Q"])
  assert.deepEqual(paths({ initialStock: "" }), [])
})

test("stockMoveSchema: signed integers, restock must be positive", () => {
  const { stockMoveSchema } = catalogSchemas({ quantity: "Q", restockPositive: "R" })
  assert.ok(stockMoveSchema.safeParse({ reason: "adjustment", qty: "-2", note: "" }).success)
  assert.ok(stockMoveSchema.safeParse({ reason: "restock", qty: "12", note: "" }).success)
  const msg = (v: object) => {
    const r = stockMoveSchema.safeParse({ reason: "restock", note: "", ...v })
    return r.success ? null : r.error.issues[0].message
  }
  assert.equal(msg({ qty: "-2" }), "R")
  assert.equal(msg({ qty: "0" }), "Q")
  assert.equal(msg({ qty: "1.5" }), "Q")
  assert.equal(msg({ reason: "sale", qty: "1" }) !== null, true)
})

// ── texts, permissions, manifest ─────────────────────────────────────────────

type Tree = { [k: string]: string | Tree }
function leaves(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, val] of Object.entries(t)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof val === "string") out.set(p, val)
    else for (const [kk, vv] of leaves(val, p)) out.set(kk, vv)
  }
  return out
}
const args = (s: string) => [...s.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)].map((m) => m[1]).sort()

test("messages: es and en have the same keys and ICU arguments; every reason has a label", () => {
  const a = leaves(es as unknown as Tree)
  const b = leaves(en as unknown as Tree)
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort())
  for (const [k, text] of a) {
    assert.ok(text.trim().length > 0, k)
    assert.deepEqual(args(text), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["catalog"])
  for (const r of MOVE_REASONS) assert.ok(es.catalog.reasons[r])
})

test("permissions: item read/write; member reads only", () => {
  assert.deepEqual(permissions.statement, { item: ["read", "write"] })
  assert.deepEqual(permissions.grants.member, { item: ["read"] })
})

test("manifest: tables, migration, routes and dependency match the files", () => {
  const m = JSON.parse(read("manifest.json")) as {
    id: string
    dependsOn: string[]
    tables: string[]
    migrations: string[]
    routes: { path: string; entry: string; group?: string }[]
    covers: string[]
  }
  assert.equal(m.id, "catalog")
  assert.deepEqual(m.dependsOn, ["storage"])
  assert.deepEqual(m.migrations, ["0106_catalog_init"])
  const sqlText = read("db/migrations/0106_catalog_init.ts")
  for (const t of m.tables) {
    assert.match(t, /^catalog_/)
    assert.ok(sqlText.includes(`create table ${t}`), t)
  }
  for (const r of m.routes) assert.ok(read(r.entry).includes("export default"), r.entry)
  assert.deepEqual(
    m.routes.filter((r) => r.group === "marketing").map((r) => r.path),
    ["/productos", "/productos/[slug]"]
  )
  for (const c of ["producto", "product", "categoría", "category", "inventario", "stock"])
    assert.ok(m.covers.includes(c), c)
})

// ── guarantees, reading the code ─────────────────────────────────────────────

test("every Server Action checks session + permission before touching data", () => {
  const src = read("server/actions.ts")
  const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(actions.sort(), [
    "addPhotoAction",
    "adjustStockAction",
    "createCategoryAction",
    "createItemAction",
    "removePhotoAction",
    "updateItemAction",
  ])
  for (const name of actions) {
    const start = src.indexOf(`export async function ${name}(`)
    const next = src.indexOf("export async function", start + 1)
    const body = src.slice(start, next === -1 ? undefined : next)
    const guard = body.indexOf('await actionSession("/catalog", "write")')
    const check = body.search(/\.safeParse\(|idOk\(/)
    const write = body.search(/await (create|update|adjust|attach|remove|getItem)\w*\(/)
    assert.ok(guard > 0, `${name}: no guard`)
    assert.ok(check > guard, `${name}: validates after the guard`)
    assert.ok(write > check, `${name}: touches data after validating`)
  }
})

test("stock: no stock column; writes lock the items first, in id order", () => {
  const migration = read("db/migrations/0106_catalog_init.ts")
  assert.doesNotMatch(migration, /\bstock\s+(integer|int|bigint|numeric)/)
  assert.match(migration, /create unique index catalog_stock_moves_ref_idx/)
  assert.match(migration, /price_minor bigint/)
  assert.match(migration, /jsonb_typeof\(attributes\) = 'object'/)
  const src = read("server/stock.ts")
  assert.match(src, /\.orderBy\("id", "asc"\)\s*\.forUpdate\(\)/)
  for (const fn of ["adjustStock", "reserveStock", "releaseStock"]) {
    const body = src.slice(src.indexOf(`export async function ${fn}(`))
    const lock = body.indexOf("lockItems(trx")
    const insert = body.indexOf("insertMove(trx")
    assert.ok(lock > 0 && insert > lock, `${fn}: locks before inserting`)
  }
  // insertMove is only called from stock.ts and from createItem (a brand-new item)
  const store = read("server/store.ts")
  assert.equal([...store.matchAll(/insertMove\(/g)].length, 1)
})
