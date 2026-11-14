import { sql, type Kysely } from "kysely"

/**
 * 0105 — crm_lite: contacts, deals (pipeline by stage) and activities.
 * Money is an integer in the currency's minor unit (bigint) + ISO 4217 code.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table crm_lite_contacts (
      id         text        primary key,
      name       text        not null check (length(name) between 1 and 200),
      email      text        check (email is null or email = lower(email)),
      phone      text,
      company    text,
      status     text        not null default 'lead'
                 check (status in ('lead', 'customer')),
      notes      text,
      owner_id   text        references "user" (id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `.execute(db)
  // One contact per e-mail (stored lower-case; contacts without e-mail are free).
  await sql`
    create unique index crm_lite_contacts_email_idx
      on crm_lite_contacts (email) where email is not null;
  `.execute(db)
  await sql`
    create index crm_lite_contacts_updated_idx
      on crm_lite_contacts (updated_at desc);
  `.execute(db)

  await sql`
    create table crm_lite_deals (
      id           text        primary key,
      contact_id   text        not null references crm_lite_contacts (id) on delete cascade,
      name         text        not null check (length(name) between 1 and 200),
      amount_minor bigint      not null default 0 check (amount_minor >= 0),
      currency     text        not null check (currency ~ '^[A-Z]{3}$'),
      stage        text        not null default 'new'
                   check (stage in ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
      owner_id     text        references "user" (id) on delete set null,
      closed_at    timestamptz,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      -- closed_at is set exactly when the deal is won or lost
      check ((stage in ('won', 'lost')) = (closed_at is not null))
    );
  `.execute(db)
  await sql`
    create index crm_lite_deals_stage_idx
      on crm_lite_deals (stage, updated_at desc);
  `.execute(db)
  await sql`
    create index crm_lite_deals_contact_idx on crm_lite_deals (contact_id);
  `.execute(db)

  await sql`
    create table crm_lite_activities (
      id         text        primary key,
      contact_id text        not null references crm_lite_contacts (id) on delete cascade,
      deal_id    text        references crm_lite_deals (id) on delete set null,
      kind       text        not null
                 check (kind in ('note', 'call', 'email', 'meeting', 'stage_change')),
      body       text,
      from_stage text,
      to_stage   text,
      author_id  text        references "user" (id) on delete set null,
      created_at timestamptz not null default now()
    );
  `.execute(db)
  await sql`
    create index crm_lite_activities_contact_idx
      on crm_lite_activities (contact_id, created_at desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists crm_lite_activities;`.execute(db)
  await sql`drop table if exists crm_lite_deals;`.execute(db)
  await sql`drop table if exists crm_lite_contacts;`.execute(db)
}
