import { sql, type Kysely } from "kysely"

/** 9000 — ping_pings. Examples use 9xxx so they never collide with a real module. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table ping_pings (
      id         text        primary key,
      message    text        not null,
      created_at timestamptz not null default now()
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists ping_pings;`.execute(db)
}
