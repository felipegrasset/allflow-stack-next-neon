import { sql, type Kysely } from "kysely"

/** 0100 — notifications: un aviso por persona, con `read_at` nulo mientras no se lee. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table notifications (
      id         text        primary key,
      user_id    text        not null references "user" (id) on delete cascade,
      kind       text        not null default 'info'
                 check (kind in ('info', 'success', 'warning', 'error')),
      title      text        not null,
      body       text,
      href       text,
      read_at    timestamptz,
      created_at timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create index notifications_user_created_idx
      on notifications (user_id, created_at desc);
  `.execute(db)
  await sql`
    create index notifications_user_unread_idx
      on notifications (user_id) where read_at is null;
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists notifications;`.execute(db)
}
