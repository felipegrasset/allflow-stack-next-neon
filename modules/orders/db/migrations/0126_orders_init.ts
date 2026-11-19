import { sql, type Kysely } from "kysely"

/**
 * 0126 — orders: orders, the photo of their lines, and their status history.
 *
 * Money is `bigint` in the currency's minor unit (as catalog and payments).
 * The database enforces the money rules too, not only the code:
 * - total = subtotal − discount, and total ≥ 1 (payments cannot charge 0);
 * - stock is released iff the order is canceled/expired
 *   (`stock_released_at` set exactly then);
 * - paid/fulfilled orders carry `paid_at` and `payment_id`;
 * - amounts and currency can only change while the order is `pending`;
 * - status only moves along the allowed transitions (same table as
 *   contracts/domain.ts `canTransition`);
 * - order lines are a photo: they cannot be updated, so a later price change
 *   in catalog never touches an order already made.
 * `user_id`, `item_id` and `actor_id` have no foreign key on purpose (users and
 * catalog items belong to other modules; history survives them).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table orders_orders (
      id                 text        primary key,
      user_id            text        not null,
      status             text        not null default 'pending'
                         check (status in ('pending', 'review', 'paid', 'fulfilled', 'canceled', 'expired')),
      currency           text        not null check (currency ~ '^[A-Z]{3}$'),
      subtotal_minor     bigint      not null check (subtotal_minor >= 0),
      discount_minor     bigint      not null default 0 check (discount_minor >= 0),
      total_minor        bigint      not null check (total_minor >= 1),
      discount_code      text        check (discount_code is null or length(discount_code) between 1 and 60),
      discount_ref       text        check (discount_ref is null or length(discount_ref) between 1 and 200),
      stock_ref          text        not null unique,
      payment_id         text,
      expires_at         timestamptz not null,
      paid_at            timestamptz,
      fulfilled_at       timestamptz,
      closed_at          timestamptz,
      stock_released_at  timestamptz,
      created_at         timestamptz not null default now(),
      updated_at         timestamptz not null default now(),
      constraint orders_total_is_subtotal_minus_discount check (total_minor = subtotal_minor - discount_minor),
      constraint orders_stock_ref_is_order check (stock_ref = 'order:' || id),
      constraint orders_released_iff_closed check ((status in ('canceled', 'expired')) = (stock_released_at is not null)),
      constraint orders_paid_has_payment check (status not in ('paid', 'fulfilled') or (paid_at is not null and payment_id is not null)),
      constraint orders_fulfilled_has_date check (status <> 'fulfilled' or fulfilled_at is not null)
    );
    create index orders_orders_user_idx on orders_orders (user_id, created_at desc);
    create index orders_orders_status_idx on orders_orders (status, created_at desc);
    create index orders_orders_pending_due_idx on orders_orders (expires_at) where status = 'pending';

    create table orders_items (
      id                text    primary key,
      order_id          text    not null references orders_orders(id) on delete cascade,
      position          integer not null check (position >= 0),
      item_id           text    not null,
      name              text    not null check (length(name) between 1 and 200),
      sku               text,
      unit_price_minor  bigint  not null check (unit_price_minor >= 0),
      qty               integer not null check (qty between 1 and 100000),
      line_total_minor  bigint  not null,
      constraint orders_items_line_total check (line_total_minor = unit_price_minor * qty),
      unique (order_id, item_id)
    );
    create index orders_items_order_idx on orders_items (order_id, position);

    create table orders_status_history (
      id           text        primary key,
      order_id     text        not null references orders_orders(id) on delete cascade,
      from_status  text,
      to_status    text        not null,
      actor_kind   text        not null check (actor_kind in ('buyer', 'staff', 'system')),
      actor_id     text,
      note         text        check (note is null or length(note) <= 300),
      created_at   timestamptz not null default now(),
      constraint orders_history_actor check ((actor_kind = 'system') = (actor_id is null))
    );
    create index orders_status_history_order_idx on orders_status_history (order_id, created_at, id);

    create function orders_guard_order_update() returns trigger language plpgsql as $$
    begin
      if (new.subtotal_minor, new.discount_minor, new.total_minor, new.currency)
         is distinct from (old.subtotal_minor, old.discount_minor, old.total_minor, old.currency)
         and old.status <> 'pending' then
        raise exception 'orders: amounts are frozen once the order leaves pending';
      end if;
      if new.user_id is distinct from old.user_id or new.stock_ref is distinct from old.stock_ref then
        raise exception 'orders: user_id and stock_ref never change';
      end if;
      if new.status is distinct from old.status and not (
           (old.status = 'pending' and new.status in ('paid', 'review', 'canceled', 'expired'))
        or (old.status = 'review'  and new.status in ('paid', 'canceled'))
        or (old.status = 'paid'    and new.status = 'fulfilled')
      ) then
        raise exception 'orders: transition % -> % not allowed', old.status, new.status;
      end if;
      if old.stock_released_at is not null and new.stock_released_at is distinct from old.stock_released_at then
        raise exception 'orders: stock is released only once';
      end if;
      return new;
    end $$;
    create trigger orders_guard_order_update before update on orders_orders
      for each row execute function orders_guard_order_update();

    create function orders_guard_frozen_row() returns trigger language plpgsql as $$
    begin
      raise exception 'orders: % rows are not updated', tg_table_name;
    end $$;
    create trigger orders_items_frozen before update on orders_items
      for each row execute function orders_guard_frozen_row();
    create trigger orders_status_history_frozen before update on orders_status_history
      for each row execute function orders_guard_frozen_row();
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists orders_status_history;
    drop table if exists orders_items;
    drop table if exists orders_orders;
    drop function if exists orders_guard_frozen_row();
    drop function if exists orders_guard_order_update();
  `.execute(db)
}
