import { sql, type Kysely } from "kysely"

/**
 * 0113 — whatsapp_optins (consent per phone number) and whatsapp_messages
 * (every message, both directions, and every blocked send).
 *
 * - The opt-in row is the permission to write to a number; no row, no send.
 * - (provider, provider_message_id) is unique: an inbound message delivered
 *   twice by the webhook is stored once (the insert is the lock).
 * - idempotency_key is unique: the same outbound key sends once.
 * - (phone, direction, created_at) serves the 24 h window lookup.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table whatsapp_optins (
      phone        text        primary key check (phone ~ '^\\+[1-9][0-9]{7,14}$'),
      status       text        not null check (status in ('opted_in', 'opted_out')),
      user_id      text        references "user" (id) on delete set null,
      source       text        not null check (source in ('form', 'keyword', 'admin', 'api')),
      evidence     text        check (char_length(evidence) <= 500),
      opted_in_at  timestamptz,
      opted_out_at timestamptz,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now()
    );
  `.execute(db)
  await sql`create index whatsapp_optins_user_idx on whatsapp_optins (user_id) where user_id is not null;`.execute(db)

  await sql`
    create table whatsapp_messages (
      id                  text        primary key,
      direction           text        not null check (direction in ('outbound', 'inbound')),
      phone               text        not null,
      kind                text        not null check (kind in ('text', 'template', 'other')),
      template_name       text,
      template_lang       text,
      body                text,
      status              text        not null check (status in
                            ('pending', 'sent', 'delivered', 'read', 'failed', 'blocked', 'received')),
      provider            text,
      provider_message_id text,
      error_code          text,
      idempotency_key     text,
      user_id             text        references "user" (id) on delete set null,
      sent_by             text        references "user" (id) on delete set null,
      created_at          timestamptz not null default now(),
      updated_at          timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create unique index whatsapp_messages_provider_id_key
      on whatsapp_messages (provider, provider_message_id)
      where provider_message_id is not null;
  `.execute(db)
  await sql`
    create unique index whatsapp_messages_idempotency_key
      on whatsapp_messages (idempotency_key)
      where idempotency_key is not null;
  `.execute(db)
  await sql`
    create index whatsapp_messages_phone_idx
      on whatsapp_messages (phone, direction, created_at desc);
  `.execute(db)
  await sql`create index whatsapp_messages_created_idx on whatsapp_messages (created_at desc);`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists whatsapp_messages;`.execute(db)
  await sql`drop table if exists whatsapp_optins;`.execute(db)
}
