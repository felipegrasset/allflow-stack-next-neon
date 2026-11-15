import { sql, type Kysely } from "kysely"

/**
 * 0124 — payments: refund guard, subscription change tracking and list indexes.
 *
 * - `payments_refund_requests`: one row per refund asked of a provider. It is
 *   written in the same transaction that locks the payment (`for update`), so
 *   two concurrent requests for the same pending amount cannot both go out.
 * - `payments_subscriptions.cancel_at`: cancellation scheduled by the provider
 *   (confirmed by webhook, never by our request).
 * - `payments_subscriptions.last_event_at`: when the provider generated the
 *   last applied event; older events are ignored.
 * - Indexes for `listPayments` (`created_at desc, id desc`, with and without
 *   the status filter).
 *
 * Inside the migration transaction: no `concurrently`. On a big `payments`
 * table the index build locks writes for its duration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table payments_refund_requests (
      id                   text        primary key,
      payment_id           text        not null references payments (id) on delete cascade,
      amount_minor         bigint      not null check (amount_minor > 0),
      expected_total_minor bigint      not null check (expected_total_minor > 0),
      full_refund          boolean     not null default false,
      status               text        not null default 'requested'
                           check (status in ('requested', 'sent', 'unknown', 'failed')),
      created_at           timestamptz not null default now(),
      updated_at           timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create index payments_refund_requests_open_idx
      on payments_refund_requests (payment_id)
      where status in ('requested', 'sent', 'unknown');
  `.execute(db)

  await sql`
    alter table payments_subscriptions
      add column cancel_at timestamptz,
      add column last_event_at timestamptz;
  `.execute(db)

  await sql`
    create index payments_created_idx on payments (created_at desc, id desc);
  `.execute(db)
  await sql`
    create index payments_status_created_idx
      on payments (status, created_at desc, id desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists payments_status_created_idx;`.execute(db)
  await sql`drop index if exists payments_created_idx;`.execute(db)
  await sql`
    alter table payments_subscriptions
      drop column if exists last_event_at,
      drop column if exists cancel_at;
  `.execute(db)
  await sql`drop table if exists payments_refund_requests;`.execute(db)
}
