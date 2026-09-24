import { sql, type Kysely } from "kysely"

/**
 * 0002 — the login rate limiter moves from process memory to Postgres
 * (server/rate-limit.ts). On Vercel every instance counted on its own, so an
 * attacker got N× the budget; with the hits in the database every instance
 * sees the same count.
 *
 * One row per accepted attempt, a sliding log: `key` is rule + IP + subject.
 * `(key, at)` serves the count of one key inside its window; `(at)` serves
 * the purge of rows older than any window, which runs on every call
 * (server/rate-limit.ts) — the table never grows past the last hour.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table rate_limit_hit (
      id  bigserial   primary key,
      key text        not null,
      at  timestamptz not null default now()
    );
    create index rate_limit_hit_key_at_idx on rate_limit_hit (key, at);
    create index rate_limit_hit_at_idx     on rate_limit_hit (at);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists rate_limit_hit;`.execute(db)
}
