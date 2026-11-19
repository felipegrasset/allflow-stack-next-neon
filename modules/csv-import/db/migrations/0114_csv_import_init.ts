import { sql, type Kysely } from "kysely"

/**
 * 0114 — csv-import: one row per import run (who, which target, how many rows).
 * The imported data itself lives in the target's own tables. `created_by` is a
 * user id with no foreign key on purpose: the history outlives the user.
 * Only counts and a stable error code are stored: never cell values.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table csv_import_runs (
      id             text        primary key,
      target         text        not null check (target ~ '^[a-z][a-z0-9_-]{0,62}$'),
      file_name      text        check (file_name is null or length(file_name) <= 255),
      status         text        not null check (status in ('done', 'failed')),
      total_rows     integer     not null check (total_rows >= 0),
      imported_rows  integer     not null default 0 check (imported_rows >= 0),
      skipped_rows   integer     not null default 0 check (skipped_rows >= 0),
      error_code     text,
      created_by     text,
      created_at     timestamptz not null default now()
    );
    create index csv_import_runs_created_idx on csv_import_runs (created_at desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists csv_import_runs;`.execute(db)
}
