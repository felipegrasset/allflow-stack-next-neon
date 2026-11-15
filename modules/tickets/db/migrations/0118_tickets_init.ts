import { sql, type Kysely } from "kysely"

/**
 * 0118 — tickets: support tickets and their message thread.
 * `requester_id` and `author_id` are user ids WITHOUT a foreign key on purpose:
 * the history survives the deletion of a user (the UI shows "deleted user").
 * `entity` + `entity_id` optionally point at a record of the app (no FK).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table tickets (
      id            text        primary key,
      subject       text        not null check (length(subject) between 1 and 200),
      status        text        not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'closed')),
      priority      text        not null default 'normal'
                    check (priority in ('low', 'normal', 'high')),
      requester_id  text        not null,
      entity        text,
      entity_id     text,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now(),
      closed_at     timestamptz
    );
    create index tickets_requester_idx on tickets (requester_id, updated_at desc);
    create index tickets_status_idx on tickets (status, updated_at desc);

    create table tickets_messages (
      id          text        primary key,
      ticket_id   text        not null references tickets(id) on delete cascade,
      author_id   text        not null,
      author_kind text        not null check (author_kind in ('requester', 'staff')),
      body        text        not null check (length(body) between 1 and 5000),
      created_at  timestamptz not null default now()
    );
    create index tickets_messages_ticket_idx on tickets_messages (ticket_id, created_at);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists tickets_messages;
    drop table if exists tickets;
  `.execute(db)
}
