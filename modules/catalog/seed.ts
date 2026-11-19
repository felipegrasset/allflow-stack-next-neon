import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"
import { es } from "./messages"

const s = es.catalog.seed

/**
 * Invented sample data (a neighbourhood shop; names and prices are fictitious).
 * Idempotent: fixed ids + `on conflict do nothing`, so re-running never
 * duplicates nor overwrites what the team edited. Stock enters as `initial`
 * moves (there is no stock column). No photos: a row without bytes in the
 * storage provider would only 404.
 */
const CATEGORIES = [
  { id: "seed-cat-c1", slug: "almacen", name: "Almacén", description: s.groceryDescription, position: 1 },
  { id: "seed-cat-c2", slug: "panaderia", name: "Panadería", description: s.bakeryDescription, position: 2 },
  { id: "seed-cat-c3", slug: "servicios", name: "Servicios", description: null, position: 3 },
]

const ITEMS = [
  { id: "seed-cat-i1", slug: "cafe-de-grano-250-g", name: "Café de grano 250 g", category_id: "seed-cat-c1", price_minor: 6990, sku: "ALM-CAFE-250", track_stock: true, attributes: { Origen: "Colombia", Tueste: "Medio", "Peso (g)": 250 } },
  { id: "seed-cat-i2", slug: "aceite-de-oliva-500-ml", name: "Aceite de oliva 500 ml", category_id: "seed-cat-c1", price_minor: 5490, sku: "ALM-OLIVA-500", track_stock: true, attributes: { Tipo: "Extra virgen", "Volumen (ml)": 500 } },
  { id: "seed-cat-i3", slug: "pan-de-masa-madre", name: "Pan de masa madre", category_id: "seed-cat-c2", price_minor: 3200, sku: "PAN-MM-01", track_stock: true, attributes: { Harina: "Integral", Vegano: true } },
  { id: "seed-cat-i4", slug: "despacho-a-domicilio", name: "Despacho a domicilio", category_id: "seed-cat-c3", price_minor: 2500, sku: null, track_stock: false, attributes: { Cobertura: "Comuna local" } },
]

const MOVES = [
  { id: "seed-cat-m1", item_id: "seed-cat-i1", qty: 24 },
  { id: "seed-cat-m2", item_id: "seed-cat-i2", qty: 12 },
  { id: "seed-cat-m3", item_id: "seed-cat-i3", qty: 3 },
]

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.insertInto("catalog_categories").values(CATEGORIES).onConflict((oc) => oc.doNothing()).execute()
  await db
    .insertInto("catalog_items")
    .values(
      ITEMS.map(({ attributes, ...i }) => ({
        ...i,
        description: null,
        currency: "CLP",
        status: "active" as const,
        attributes: JSON.stringify(attributes),
      }))
    )
    .onConflict((oc) => oc.doNothing())
    .execute()
  await db
    .insertInto("catalog_stock_moves")
    .values(MOVES.map((m) => ({ ...m, reason: "initial" as const, ref: null, note: null })))
    .onConflict((oc) => oc.doNothing())
    .execute()
}
