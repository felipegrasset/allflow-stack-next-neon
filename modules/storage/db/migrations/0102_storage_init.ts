import { sql, type Kysely } from "kysely"

/**
 * 0102 — storage_files: one row per stored object. The bytes live in the
 * provider (`provider` + `provider_key`); this row is the metadata, the owner
 * and the optional link to an entity of another module (`entity` + `entity_id`).
 * `content_type` is the type sniffed from the bytes, never the browser's.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table storage_files (
      id           text        primary key,
      owner_id     text        references "user" (id) on delete set null,
      name         text        not null,
      content_type text        not null,
      size_bytes   integer     not null check (size_bytes > 0),
      provider     text        not null,
      provider_key text        not null,
      visibility   text        not null default 'private'
                   check (visibility in ('private', 'members', 'public')),
      entity       text,
      entity_id    text,
      created_at   timestamptz not null default now(),
      check ((entity is null) = (entity_id is null))
    );
  `.execute(db)
  await sql`
    create index storage_files_entity_idx
      on storage_files (entity, entity_id, created_at)
      where entity is not null;
  `.execute(db)
  await sql`
    create index storage_files_owner_idx
      on storage_files (owner_id, created_at desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists storage_files;`.execute(db)
}
