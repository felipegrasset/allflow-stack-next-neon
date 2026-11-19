import { sql, type Kysely } from "kysely"

/**
 * 0119 — push: one row per browser subscription (PushSubscription). The
 * endpoint is unique: the same browser subscribing again updates its row.
 * A subscription the push service answers 404/410 for is deleted on send.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table push_subscriptions (
      id              text        primary key,
      user_id         text        not null references "user" (id) on delete cascade,
      endpoint        text        not null,
      p256dh          text        not null,
      auth            text        not null,
      failure_count   integer     not null default 0,
      last_success_at timestamptz,
      created_at      timestamptz not null default now(),
      updated_at      timestamptz not null default now()
    );
  `.execute(db)
  await sql`create unique index push_subscriptions_endpoint_idx on push_subscriptions (endpoint);`.execute(db)
  await sql`create index push_subscriptions_user_idx on push_subscriptions (user_id);`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists push_subscriptions;`.execute(db)
}
