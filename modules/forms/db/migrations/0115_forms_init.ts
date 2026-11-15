import { sql, type Kysely } from "kysely"

/**
 * 0115 — forms: a form is a row with its definition as validated jsonb;
 * responses hold the answers as jsonb, keyed by field id.
 *
 * `created_by` is a user id WITHOUT a foreign key on purpose (the form and its
 * results outlive the person who made it). `respondent_key` is "u:<userId>"
 * for signed-in respondents and only set when the form asks for one response
 * per person: the partial unique index is what enforces it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table forms_forms (
      id              text        primary key,
      slug            text        not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
      title           text        not null check (length(title) between 1 and 300),
      status          text        not null default 'draft' check (status in ('draft', 'open', 'closed')),
      one_per_person  boolean     not null default false,
      definition      jsonb       not null,
      created_by      text,
      created_at      timestamptz not null default now(),
      updated_at      timestamptz not null default now()
    );
    create index forms_forms_created_idx on forms_forms (created_at desc);

    create table forms_responses (
      id              text        primary key,
      form_id         text        not null references forms_forms(id) on delete cascade,
      answers         jsonb       not null,
      respondent_key  text,
      locale          text,
      created_at      timestamptz not null default now()
    );
    create index forms_responses_form_idx on forms_responses (form_id, created_at desc);
    -- One response per person and form (only rows that carry a respondent key).
    create unique index forms_responses_person_uq
      on forms_responses (form_id, respondent_key) where respondent_key is not null;
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists forms_responses;
    drop table if exists forms_forms;
  `.execute(db)
}
