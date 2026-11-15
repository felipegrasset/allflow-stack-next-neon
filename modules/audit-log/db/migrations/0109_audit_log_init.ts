import { sql, type Kysely } from "kysely"

/**
 * 0109 — audit_log: who changed what and when. Append-only: a trigger rejects
 * every UPDATE and every DELETE, except the DELETE of demo rows whose id starts
 * with "seed-" (so the sample data can be removed; real rows are untouched).
 *
 * `actor_id` has no foreign key on purpose: the log must survive the deletion
 * of a user. `entity_id` points at any record of the app (no foreign key).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table audit_log (
      id          text        primary key,
      actor_id    text,
      actor_name  text,
      action      text        not null,
      entity      text        not null,
      entity_id   text        not null,
      diff        jsonb       not null default '{}'::jsonb,
      created_at  timestamptz not null default now()
    );
    create index audit_log_created_idx on audit_log (created_at desc, id desc);
    create index audit_log_entity_idx  on audit_log (entity, entity_id, created_at desc);
    create index audit_log_actor_idx   on audit_log (actor_id, created_at desc);
    create index audit_log_action_idx  on audit_log (action, created_at desc);

    create function audit_log_immutable() returns trigger
      language plpgsql as $$
      begin
        if tg_op = 'DELETE' and old.id like 'seed-%' then
          return old;
        end if;
        raise exception 'audit_log is append-only';
      end;
      $$;
    create trigger audit_log_no_change
      before update or delete on audit_log
      for each row execute function audit_log_immutable();
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists audit_log;
    drop function if exists audit_log_immutable();
  `.execute(db)
}
