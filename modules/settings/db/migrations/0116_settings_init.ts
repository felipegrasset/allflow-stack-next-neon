import { sql, type Kysely } from "kysely"

/**
 * 0116 — settings: one row per key with a jsonb value. Only keys that were
 * changed have a row; a missing row means "the default declared in code".
 * `updated_by` is a user id with no foreign key on purpose.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table settings (
      key         text        primary key
                  check (key ~ '^[a-z][a-z0-9_.-]{0,99}$'),
      value       jsonb       not null,
      updated_by  text,
      updated_at  timestamptz not null default now()
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists settings;`.execute(db)
}
