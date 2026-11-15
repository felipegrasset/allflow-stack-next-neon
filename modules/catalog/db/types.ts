import type { ColumnType, Generated } from "kysely"

import type { Attributes } from "../contracts/types"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

/** bigint: node-postgres and Neon return int8 as a string. */
type BigintMinor = ColumnType<
  string | number,
  number | string | bigint,
  number | string | bigint
>

/** jsonb: read as the parsed object, written as JSON text (works with pg and Neon alike). */
type JsonAttributes = ColumnType<Attributes, string | undefined, string>

export interface CatalogCategoriesTable {
  id: string
  slug: string
  name: string
  description: string | null
  position: Generated<number>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CatalogItemsTable {
  id: string
  slug: string
  name: string
  description: string | null
  category_id: string | null
  price_minor: BigintMinor
  currency: string
  attributes: JsonAttributes
  status: Generated<"draft" | "active" | "archived">
  track_stock: Generated<boolean>
  sku: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CatalogStockMovesTable {
  id: string
  item_id: string
  qty: number
  reason: "initial" | "restock" | "adjustment" | "sale" | "sale_reverted"
  ref: string | null
  note: string | null
  created_by: string | null
  created_at: Timestamp
}

/** Interface merging: adds the tables to `Database` without editing server/db/schema/index.ts. */
declare module "@/server/db/schema" {
  interface Database {
    catalog_categories: CatalogCategoriesTable
    catalog_items: CatalogItemsTable
    catalog_stock_moves: CatalogStockMovesTable
  }
}
