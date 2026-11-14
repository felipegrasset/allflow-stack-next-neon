import { sql, type Kysely } from "kysely"

/**
 * 0104 — reports_dashboards: one row per dashboard. `definition` is the whole
 * definition (sources whitelist + cards) as jsonb; it is validated with Zod
 * when written and again when read (contracts/definition.ts).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table reports_dashboards (
      id         text        primary key,
      definition jsonb       not null,
      position   integer     not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists reports_dashboards;`.execute(db)
}
