import { sql, type Kysely } from "kysely"

/**
 * 0120 — comments: plain-text comments on any record of the app.
 * `entity` + `entity_id` point at the record WITHOUT a foreign key (the module
 * does not know the app's tables). `author_id` is a user id without FK on
 * purpose: the history survives the deletion of a user.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table comments (
      id         text        primary key,
      entity     text        not null check (entity ~ '^[a-z0-9][a-z0-9_.-]{0,62}$'),
      entity_id  text        not null check (length(entity_id) between 1 and 200),
      author_id  text        not null,
      body       text        not null check (length(body) between 1 and 2000),
      created_at timestamptz not null default now()
    );
    create index comments_entity_idx on comments (entity, entity_id, created_at);
    create index comments_author_idx on comments (author_id);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists comments;`.execute(db)
}
