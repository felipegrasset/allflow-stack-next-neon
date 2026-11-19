import { sql, type Kysely } from "kysely"

/**
 * 0110 — jobs_runs: one row per run of a scheduled job.
 *
 * The lock lives here: a partial unique index allows at most ONE row with
 * status 'running' per job name, so a second run cannot start while the first
 * is alive (the insert fails with a unique violation and the runner reports
 * "skipped"). `lock_expires_at` lets a later run take over after a crashed one.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table jobs_runs (
      id              text        primary key,
      name            text        not null,
      kind            text        not null check (kind in ('cron', 'manual')),
      status          text        not null default 'running'
                                  check (status in ('running', 'succeeded', 'failed')),
      triggered_by    text,
      started_at      timestamptz not null default now(),
      finished_at     timestamptz,
      duration_ms     integer,
      lock_expires_at timestamptz not null,
      error           text,
      result          jsonb
    );
    create unique index jobs_runs_one_running on jobs_runs (name) where status = 'running';
    create index jobs_runs_started_idx on jobs_runs (started_at desc, id desc);
    create index jobs_runs_name_idx on jobs_runs (name, started_at desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists jobs_runs`.execute(db)
}
