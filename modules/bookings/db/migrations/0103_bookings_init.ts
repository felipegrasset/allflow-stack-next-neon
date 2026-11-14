import { sql, type Kysely } from "kysely"

/**
 * 0103 — bookings: resources, their weekly opening hours and the bookings.
 *
 * No double booking is guaranteed HERE, not in the UI: an exclusion constraint
 * forbids two confirmed bookings of the same resource whose [starts_at,
 * ends_at) ranges overlap. It needs `btree_gist` (text equality inside a GiST
 * index); Neon and stock Postgres ship it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create extension if not exists btree_gist;`.execute(db)

  await sql`
    create table bookings_resources (
      id           text        primary key,
      name         text        not null check (length(btrim(name)) between 1 and 120),
      kind         text        not null default 'service'
                   check (kind in ('room', 'professional', 'service')),
      details      text,
      timezone     text        not null,
      slot_minutes integer     not null default 60 check (slot_minutes between 5 and 720),
      active       boolean     not null default true,
      created_at   timestamptz not null default now()
    );
  `.execute(db)

  await sql`
    create table bookings_schedules (
      id           text        primary key,
      resource_id  text        not null references bookings_resources (id) on delete cascade,
      weekday      smallint    not null check (weekday between 0 and 6),
      start_minute integer     not null check (start_minute between 0 and 1439),
      end_minute   integer     not null check (end_minute between 1 and 1440),
      created_at   timestamptz not null default now(),
      check (end_minute > start_minute)
    );
  `.execute(db)
  await sql`
    create index bookings_schedules_resource_idx
      on bookings_schedules (resource_id, weekday);
  `.execute(db)

  await sql`
    create table bookings_bookings (
      id           text        primary key,
      resource_id  text        not null references bookings_resources (id) on delete restrict,
      user_id      text        not null references "user" (id) on delete cascade,
      starts_at    timestamptz not null,
      ends_at      timestamptz not null,
      status       text        not null default 'confirmed'
                   check (status in ('confirmed', 'cancelled')),
      note         text,
      cancelled_at timestamptz,
      cancelled_by text        references "user" (id) on delete set null,
      created_at   timestamptz not null default now(),
      check (ends_at > starts_at),
      constraint bookings_bookings_no_overlap exclude using gist (
        resource_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      ) where (status = 'confirmed')
    );
  `.execute(db)
  await sql`
    create index bookings_bookings_resource_starts_idx
      on bookings_bookings (resource_id, starts_at);
  `.execute(db)
  await sql`
    create index bookings_bookings_user_starts_idx
      on bookings_bookings (user_id, starts_at);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists bookings_bookings;`.execute(db)
  await sql`drop table if exists bookings_schedules;`.execute(db)
  await sql`drop table if exists bookings_resources;`.execute(db)
  // btree_gist stays: other tables may use it.
}
