import { sql, type Kysely } from "kysely"

/**
 * 0122 — calendar-sync: Google accounts (tokens encrypted), one-time OAuth
 * states and the event of each booking.
 *
 * - `calendar_sync_accounts`: one per user. `access_token_enc` and
 *   `refresh_token_enc` hold AES-256-GCM ciphertext (server/crypto.ts), never
 *   the token. A disconnected account keeps its row (status + reason) without
 *   tokens.
 * - `calendar_sync_states`: the nonce of each OAuth flow started, deleted by
 *   the callback that uses it (single use) or when it expires.
 * - `calendar_sync_events`: the event of each booking in its owner's calendar
 *   (id deterministic per booking), what was last asked (`desired`) and the
 *   retry bookkeeping. `booking_id` has no foreign key on purpose: bookings
 *   is only reached through its contracts, and its rows are never deleted.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table calendar_sync_accounts (
      user_id           text        primary key references "user" (id) on delete cascade,
      status            text        not null default 'connected'
                        check (status in ('connected', 'disconnected')),
      disconnect_reason text        check (disconnect_reason in ('user', 'revoked', 'scope')),
      scopes            text        not null default '',
      calendar_id       text        not null default 'primary',
      access_token_enc  text,
      access_expires_at timestamptz,
      refresh_token_enc text,
      connected_at      timestamptz not null default now(),
      updated_at        timestamptz not null default now(),
      check (status = 'disconnected' or refresh_token_enc is not null)
    );
  `.execute(db)

  await sql`
    create table calendar_sync_states (
      nonce        text        primary key,
      user_id      text        not null references "user" (id) on delete cascade,
      verifier_enc text        not null,
      expires_at   timestamptz not null,
      created_at   timestamptz not null default now()
    );
  `.execute(db)
  await sql`create index calendar_sync_states_expires_idx on calendar_sync_states (expires_at);`.execute(db)

  await sql`
    create table calendar_sync_events (
      booking_id      text        primary key,
      user_id         text        not null references "user" (id) on delete cascade,
      event_id        text        not null,
      calendar_id     text        not null default 'primary',
      desired         text        not null check (desired in ('confirmed', 'cancelled')),
      state           text        not null default 'pending'
                      check (state in ('pending', 'synced', 'failed', 'skipped')),
      fingerprint     text        not null,
      starts_at       timestamptz not null,
      ends_at         timestamptz not null,
      summary         text        not null,
      timezone        text        not null,
      attempts        integer     not null default 0,
      last_error      text,
      next_attempt_at timestamptz,
      synced_at       timestamptz,
      updated_at      timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create index calendar_sync_events_due_idx
      on calendar_sync_events (next_attempt_at)
      where state in ('pending', 'failed') and next_attempt_at is not null;
  `.execute(db)
  await sql`create index calendar_sync_events_user_idx on calendar_sync_events (user_id, state);`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists calendar_sync_events;`.execute(db)
  await sql`drop table if exists calendar_sync_states;`.execute(db)
  await sql`drop table if exists calendar_sync_accounts;`.execute(db)
}
