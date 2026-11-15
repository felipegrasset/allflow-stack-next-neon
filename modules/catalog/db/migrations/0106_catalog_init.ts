import { sql, type Kysely } from "kysely"

/**
 * 0106 — catalog: categories, items (free attributes in jsonb, price as an
 * integer in the currency's minor unit + ISO 4217 code) and stock moves.
 *
 * There is NO stock column: an item's stock is the sum of its moves. Every
 * write of a move goes through server/stock.ts, which locks the item rows
 * (`for update`) before reading the sum, so two checkouts never sell the same
 * last unit. The unique index on (item_id, reason, ref) makes a `sale` and its
 * `sale_reverted` happen at most once per reference (idempotent checkouts).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table catalog_categories (
      id          text        primary key,
      slug        text        not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
      name        text        not null check (length(name) between 1 and 100),
      description text,
      position    integer     not null default 0,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
  `.execute(db)

  await sql`
    create table catalog_items (
      id          text        primary key,
      slug        text        not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
      name        text        not null check (length(name) between 1 and 200),
      description text,
      category_id text        references catalog_categories (id) on delete set null,
      price_minor bigint      not null check (price_minor >= 0),
      currency    text        not null check (currency ~ '^[A-Z]{3}$'),
      attributes  jsonb       not null default '{}'::jsonb
                  check (jsonb_typeof(attributes) = 'object'),
      status      text        not null default 'draft'
                  check (status in ('draft', 'active', 'archived')),
      track_stock boolean     not null default true,
      sku         text        unique check (sku is null or length(sku) between 1 and 64),
      created_by  text        references "user" (id) on delete set null,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create index catalog_items_status_idx
      on catalog_items (status, category_id, name);
  `.execute(db)

  // Items are archived, never deleted, while they have moves (restrict).
  await sql`
    create table catalog_stock_moves (
      id         text        primary key,
      item_id    text        not null references catalog_items (id) on delete restrict,
      qty        integer     not null check (qty <> 0),
      reason     text        not null
                 check (reason in ('initial', 'restock', 'adjustment', 'sale', 'sale_reverted')),
      ref        text        check (ref is null or length(ref) between 1 and 200),
      note       text,
      created_by text        references "user" (id) on delete set null,
      created_at timestamptz not null default now(),
      -- the sign follows the reason; sales and their reversal always carry a ref
      check (
        (reason in ('initial', 'restock', 'sale_reverted') and qty > 0)
        or (reason = 'sale' and qty < 0)
        or reason = 'adjustment'
      ),
      check (reason not in ('sale', 'sale_reverted') or ref is not null)
    );
  `.execute(db)
  await sql`
    create index catalog_stock_moves_item_idx
      on catalog_stock_moves (item_id, created_at desc);
  `.execute(db)
  await sql`
    create unique index catalog_stock_moves_ref_idx
      on catalog_stock_moves (item_id, reason, ref) where ref is not null;
  `.execute(db)
  await sql`
    create index catalog_stock_moves_by_ref_idx
      on catalog_stock_moves (ref) where ref is not null;
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists catalog_stock_moves;`.execute(db)
  await sql`drop table if exists catalog_items;`.execute(db)
  await sql`drop table if exists catalog_categories;`.execute(db)
}
