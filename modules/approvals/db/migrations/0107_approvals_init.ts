import { sql, type Kysely } from "kysely"

/**
 * 0107 — approvals: flows (definition as validated jsonb), requests (point at
 * "entity + id" of the app with NO foreign key, keep a snapshot of the flow)
 * and events (append-only history; UPDATE is rejected by a trigger).
 *
 * `requested_by` and `actor_id` are user ids without a foreign key on purpose:
 * the history must survive the deletion of a user.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table approvals_flows (
      id          text        primary key,
      key         text        not null unique,
      definition  jsonb       not null,
      active      boolean     not null default true,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );

    create table approvals_requests (
      id            text        primary key,
      flow_id       text        not null references approvals_flows(id) on delete restrict,
      flow_key      text        not null,
      definition    jsonb       not null,
      entity        text        not null,
      entity_id     text        not null,
      title         text        not null,
      href          text,
      state         text        not null,
      requested_by  text        not null,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now(),
      closed_at     timestamptz
    );
    -- One open request per flow and record: a second requestApproval fails.
    create unique index approvals_requests_open_uq
      on approvals_requests (flow_id, entity, entity_id) where closed_at is null;
    create index approvals_requests_entity_idx
      on approvals_requests (entity, entity_id, created_at desc);
    create index approvals_requests_open_idx
      on approvals_requests (created_at desc) where closed_at is null;
    create index approvals_requests_requester_idx
      on approvals_requests (requested_by, created_at desc);

    create table approvals_events (
      id          text        primary key,
      request_id  text        not null references approvals_requests(id) on delete cascade,
      actor_id    text        not null,
      action      text        not null,
      from_state  text,
      to_state    text        not null,
      comment     text,
      created_at  timestamptz not null default now()
    );
    create index approvals_events_request_idx on approvals_events (request_id, created_at);

    create function approvals_events_immutable() returns trigger
      language plpgsql as $$
      begin
        raise exception 'approvals_events is append-only';
      end;
      $$;
    create trigger approvals_events_no_update
      before update on approvals_events
      for each row execute function approvals_events_immutable();
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists approvals_events;
    drop function if exists approvals_events_immutable();
    drop table if exists approvals_requests;
    drop table if exists approvals_flows;
  `.execute(db)
}
