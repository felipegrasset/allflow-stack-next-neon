import { sql, type Kysely } from "kysely"

/**
 * 0101 — payments: pagos, eventos de proveedor (el registro que da la
 * idempotencia) y suscripciones. Los montos son enteros en la unidad menor de
 * la moneda; nada guarda llaves ni cuerpos crudos de webhook.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table payments (
      id                  text        primary key,
      order_id            text        not null,
      provider            text        not null
                          check (provider in ('mercadopago', 'flow', 'paddle')),
      environment         text        not null
                          check (environment in ('sandbox', 'production')),
      status              text        not null default 'pending'
                          check (status in ('pending', 'failed', 'approved', 'refunded', 'canceled', 'needs_review')),
      amount_minor        bigint      not null check (amount_minor > 0),
      currency            char(3)     not null,
      refunded_minor      bigint      not null default 0
                          check (refunded_minor >= 0 and refunded_minor <= amount_minor),
      description         text        not null,
      payer_email         text,
      external_id         text,
      provider_payment_id text,
      checkout_url        text,
      created_at          timestamptz not null default now(),
      updated_at          timestamptz not null default now(),
      approved_at         timestamptz
    );
  `.execute(db)
  // Una orden con un pago activo no admite otro: el índice, no el código, lo garantiza.
  await sql`
    create unique index payments_one_active_per_order
      on payments (order_id)
      where status in ('pending', 'failed', 'approved', 'needs_review');
  `.execute(db)
  await sql`create index payments_order_idx on payments (order_id);`.execute(db)
  await sql`
    create index payments_external_idx
      on payments (provider, external_id) where external_id is not null;
  `.execute(db)
  await sql`
    create index payments_provider_payment_idx
      on payments (provider, provider_payment_id) where provider_payment_id is not null;
  `.execute(db)

  // El insert en esta tabla ES el candado de idempotencia: (provider, event_id) único.
  await sql`
    create table payments_events (
      id           text        primary key,
      provider     text        not null,
      event_id     text        not null,
      type         text        not null,
      outcome      text        not null,
      payment_id   text        references payments (id) on delete set null,
      amount_minor bigint,
      currency     char(3),
      received_at  timestamptz not null default now(),
      unique (provider, event_id)
    );
  `.execute(db)
  await sql`create index payments_events_payment_idx on payments_events (payment_id);`.execute(
    db
  )

  await sql`
    create table payments_subscriptions (
      id                 text        primary key,
      provider           text        not null
                         check (provider in ('mercadopago', 'flow', 'paddle')),
      external_id        text        not null,
      subscriber_ref     text        not null,
      plan_ref           text,
      status             text        not null default 'pending'
                         check (status in ('pending', 'active', 'past_due', 'canceled')),
      current_period_end timestamptz,
      created_at         timestamptz not null default now(),
      updated_at         timestamptz not null default now(),
      unique (provider, external_id)
    );
  `.execute(db)
  await sql`
    create index payments_subscriptions_subscriber_idx
      on payments_subscriptions (subscriber_ref);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists payments_subscriptions;`.execute(db)
  await sql`drop table if exists payments_events;`.execute(db)
  await sql`drop table if exists payments;`.execute(db)
}
