import { sql, type Kysely } from "kysely"

/**
 * 0125 — plans: the plan catalog (`plans_plans`) and what each plan grants
 * (`plans_entitlements`). No prices: prices live in the payment provider.
 *
 * `plan_ref` is the provider plan id a subscription of payments carries
 * (`payments_subscriptions.plan_ref`). It is unique, so one provider plan maps
 * to exactly one plan of the app. There is no foreign key to payments on
 * purpose: payments owns its tables and this module only reads them through
 * `payments/contracts`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table plans_plans (
      id              text        primary key,
      key             text        not null unique
                      check (key ~ '^[a-z][a-z0-9_.-]{0,63}$'),
      name_es         text        not null check (length(name_es) between 1 and 80),
      name_en         text        not null check (length(name_en) between 1 and 80),
      description_es  text,
      description_en  text,
      plan_ref        text        unique,
      is_default      boolean     not null default false,
      active          boolean     not null default true,
      sort            integer     not null default 0,
      created_at      timestamptz not null default now(),
      updated_at      timestamptz not null default now()
    );
    -- At most one default plan: two concurrent "make default" end with one.
    create unique index plans_plans_one_default_uq
      on plans_plans (is_default) where is_default;

    create table plans_entitlements (
      id           text        primary key,
      plan_id      text        not null references plans_plans(id) on delete cascade,
      key          text        not null
                   check (key ~ '^[a-z][a-z0-9_.-]{0,63}$'),
      kind         text        not null check (kind in ('feature', 'limit')),
      enabled      boolean     not null default false,
      limit_value  bigint      check (limit_value is null or limit_value between 0 and 1000000000000),
      label_es     text,
      label_en     text,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      unique (plan_id, key),
      -- a feature never carries a number; a limit never carries a flag
      check (kind = 'limit' or limit_value is null),
      check (kind = 'feature' or enabled = false)
    );
    create index plans_entitlements_key_idx on plans_entitlements (key);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists plans_entitlements;`.execute(db)
  await sql`drop table if exists plans_plans;`.execute(db)
}
