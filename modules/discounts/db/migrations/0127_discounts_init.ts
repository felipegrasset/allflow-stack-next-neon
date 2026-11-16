import { sql, type Kysely } from "kysely"

/**
 * 0127 — discounts: codes and their uses (redemptions).
 *
 * The database enforces the money rules too, not only the code:
 * - a code is stored normalised (upper case, A-Z 0-9 _ -, 3..40) and unique;
 * - percent ⇔ percent_bp (1..10000); fixed ⇔ amount_minor ≥ 1 and a currency;
 *   a minimum purchase needs a currency; starts_at < ends_at; caps ≥ 1;
 * - AT MOST ONE ACTIVE USE PER ORDER (partial unique index);
 * - THE USAGE CAPS: a trigger locks the code's row (`for update`) and counts
 *   its active uses before every insert, so two concurrent redemptions of the
 *   last use cannot both commit, whatever code path inserts them;
 * - a use is a photo: only `released_at`/`release_reason` (once, together),
 *   `confirmed_at` (once) and `checked_at` may change; a released use is never
 *   re-activated.
 * `order_id` and `user_id` have no foreign key on purpose (orders and users
 * belong to other modules; the history survives them).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table discounts_codes (
      id                  text        primary key,
      code                text        not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
      kind                text        not null check (kind in ('percent', 'fixed')),
      percent_bp          integer     check (percent_bp between 1 and 10000),
      amount_minor        bigint      check (amount_minor >= 1),
      currency            text        check (currency ~ '^[A-Z]{3}$'),
      min_subtotal_minor  bigint      check (min_subtotal_minor >= 1),
      starts_at           timestamptz,
      ends_at             timestamptz,
      max_uses            integer     check (max_uses >= 1),
      max_uses_per_user   integer     check (max_uses_per_user >= 1),
      active              boolean     not null default true,
      note                text        check (note is null or length(note) <= 200),
      created_by          text,
      created_at          timestamptz not null default now(),
      updated_at          timestamptz not null default now(),
      constraint discounts_codes_percent check ((kind = 'percent') = (percent_bp is not null)),
      constraint discounts_codes_fixed check ((kind = 'fixed') = (amount_minor is not null)),
      constraint discounts_codes_fixed_currency check (kind <> 'fixed' or currency is not null),
      constraint discounts_codes_min_currency check (min_subtotal_minor is null or currency is not null),
      constraint discounts_codes_dates check (starts_at is null or ends_at is null or starts_at < ends_at),
      constraint discounts_codes_caps check (max_uses is null or max_uses_per_user is null or max_uses_per_user <= max_uses)
    );

    create table discounts_redemptions (
      id              text        primary key,
      code_id         text        not null references discounts_codes(id) on delete restrict,
      code            text        not null,
      order_id        text        not null,
      user_id         text        not null,
      amount_minor    bigint      not null check (amount_minor >= 1),
      currency        text        not null check (currency ~ '^[A-Z]{3}$'),
      subtotal_minor  bigint      not null check (subtotal_minor > amount_minor),
      created_at      timestamptz not null default now(),
      released_at     timestamptz,
      release_reason  text        check (release_reason in ('removed', 'replaced', 'order_canceled', 'order_expired', 'order_missing')),
      confirmed_at    timestamptz,
      checked_at      timestamptz,
      constraint discounts_redemptions_release check ((released_at is null) = (release_reason is null)),
      constraint discounts_redemptions_final check (released_at is null or confirmed_at is null)
    );
    create unique index discounts_redemptions_one_per_order on discounts_redemptions (order_id) where released_at is null;
    create index discounts_redemptions_code_active on discounts_redemptions (code_id, user_id) where released_at is null;
    create index discounts_redemptions_code_recent on discounts_redemptions (code_id, created_at desc);
    create index discounts_redemptions_sweep on discounts_redemptions (coalesce(checked_at, created_at))
      where released_at is null and confirmed_at is null;

    create function discounts_enforce_caps() returns trigger language plpgsql as $$
    declare
      c record;
      n integer;
    begin
      select max_uses, max_uses_per_user into c from discounts_codes where id = new.code_id for update;
      if c.max_uses is not null then
        select count(*) into n from discounts_redemptions where code_id = new.code_id and released_at is null;
        if n >= c.max_uses then
          raise exception 'discounts: usage limit reached' using errcode = 'check_violation';
        end if;
      end if;
      if c.max_uses_per_user is not null then
        select count(*) into n from discounts_redemptions
          where code_id = new.code_id and user_id = new.user_id and released_at is null;
        if n >= c.max_uses_per_user then
          raise exception 'discounts: per-user limit reached' using errcode = 'check_violation';
        end if;
      end if;
      return new;
    end $$;
    create trigger discounts_enforce_caps before insert on discounts_redemptions
      for each row when (new.released_at is null) execute function discounts_enforce_caps();

    create function discounts_guard_redemption() returns trigger language plpgsql as $$
    begin
      if (new.id, new.code_id, new.code, new.order_id, new.user_id, new.amount_minor, new.currency,
          new.subtotal_minor, new.created_at)
         is distinct from (old.id, old.code_id, old.code, old.order_id, old.user_id, old.amount_minor,
          old.currency, old.subtotal_minor, old.created_at) then
        raise exception 'discounts: a redemption is a photo';
      end if;
      if old.released_at is not null and (new.released_at, new.release_reason) is distinct from (old.released_at, old.release_reason) then
        raise exception 'discounts: a use is released only once';
      end if;
      if old.confirmed_at is not null and new.confirmed_at is distinct from old.confirmed_at then
        raise exception 'discounts: a use is confirmed only once';
      end if;
      return new;
    end $$;
    create trigger discounts_guard_redemption before update on discounts_redemptions
      for each row execute function discounts_guard_redemption();
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists discounts_redemptions;
    drop table if exists discounts_codes;
    drop function if exists discounts_enforce_caps();
    drop function if exists discounts_guard_redemption();
  `.execute(db)
}
