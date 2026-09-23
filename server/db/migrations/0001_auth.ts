import { sql, type Kysely } from "kysely"

/**
 * 0001 — the standard user schema of AllFlow's stack templates: Better Auth's
 * core tables + the organization plugin (with dynamic access control), plus
 * the floor's additionalFields (`onboardedAt`, `locale`).
 *
 * Source: docs/scaffolding/DECISION-AUTH-STANDARDS.md §"El esquema de usuarios
 * estándar" in allflow.biz. `pnpm db:migrate` runs it and then asks Better Auth
 * (`getMigrations`) whether the live schema matches the auth config — so if a
 * Better Auth upgrade adds a column, the command fails loudly instead of the
 * sign-up failing in production.
 *
 * Three differences with the DDL in that document, all demanded by Better
 * Auth 1.7.5's own schema check (the drift check above caught them):
 * `organization.slug` is NOT NULL, `invitation` has "createdAt", and
 * `"organizationRole"` has "updatedAt".
 *
 * The table is `"user"` (D3): reserved word in Postgres, always quoted.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table "user" (
      id              text primary key,
      name            text        not null,
      email           text        not null unique,
      "emailVerified" boolean     not null default false,
      image           text,
      "onboardedAt"   timestamptz,
      locale          text        not null default 'es',
      "createdAt"     timestamptz not null default now(),
      "updatedAt"     timestamptz not null default now()
    );

    create table session (
      id                     text primary key,
      "userId"               text        not null references "user"(id) on delete cascade,
      token                  text        not null unique,
      "expiresAt"            timestamptz not null,
      "ipAddress"            text,
      "userAgent"            text,
      "activeOrganizationId" text,
      "createdAt"            timestamptz not null default now(),
      "updatedAt"            timestamptz not null default now()
    );
    create index session_user_idx    on session("userId");
    create index session_expires_idx on session("expiresAt");

    create table account (
      id                      text primary key,
      "userId"                text not null references "user"(id) on delete cascade,
      "accountId"             text not null,
      "providerId"            text not null,
      "accessToken"           text,
      "refreshToken"          text,
      "idToken"               text,
      "accessTokenExpiresAt"  timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      scope                   text,
      password                text,
      "createdAt"             timestamptz not null default now(),
      "updatedAt"             timestamptz not null default now(),
      unique ("providerId", "accountId")
    );
    create index account_user_idx on account("userId");

    create table verification (
      id          text primary key,
      identifier  text        not null,
      value       text        not null,
      "expiresAt" timestamptz not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    );
    create index verification_identifier_idx on verification(identifier);

    create table organization (
      id          text primary key,
      name        text not null,
      slug        text not null unique,
      logo        text,
      metadata    text,
      "createdAt" timestamptz not null default now()
    );

    create table member (
      id               text primary key,
      "organizationId" text not null references organization(id) on delete cascade,
      "userId"         text not null references "user"(id) on delete cascade,
      role             text not null default 'member',
      "createdAt"      timestamptz not null default now(),
      unique ("organizationId", "userId")
    );

    create table invitation (
      id               text primary key,
      "organizationId" text not null references organization(id) on delete cascade,
      email            text not null,
      role             text,
      status           text not null default 'pending',
      "expiresAt"      timestamptz not null,
      "inviterId"      text not null references "user"(id) on delete cascade,
      "createdAt"      timestamptz not null default now()
    );

    create table "organizationRole" (
      id               text primary key,
      "organizationId" text not null references organization(id) on delete cascade,
      role             text not null,
      permission       text not null,
      "createdAt"      timestamptz not null default now(),
      "updatedAt"      timestamptz,
      unique ("organizationId", role)
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists "organizationRole", invitation, member, organization,
      verification, account, session, "user" cascade;
  `.execute(db)
}
