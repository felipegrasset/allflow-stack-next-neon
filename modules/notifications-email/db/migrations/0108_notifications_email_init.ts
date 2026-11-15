import { sql, type Kysely } from "kysely"

/**
 * 0108 — notifications-email: one row per person who CHANGED the default.
 * No row = emails on. `user_id` has no foreign key on purpose (same as the
 * other modules): the unsubscribe link must keep working and history survives.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table notifications_email_prefs (
      user_id    text        primary key,
      enabled    boolean     not null default true,
      updated_at timestamptz not null default now()
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists notifications_email_prefs;`.execute(db)
}
