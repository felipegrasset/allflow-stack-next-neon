import { sql, type Kysely } from "kysely"

/**
 * 0117 — help-center: articles (plain text / minimal markdown) and one rating
 * per visitor per article. `author_id` has no foreign key (articles outlive
 * their author); `voter_hash` is a hash of an anonymous cookie token.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table help_center_articles (
      id            text        primary key,
      slug          text        not null unique
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
      title         text        not null check (char_length(title) between 1 and 160),
      summary       text        check (char_length(summary) <= 300),
      body          text        not null check (char_length(body) <= 20000),
      category      text        check (char_length(category) <= 60),
      locale        text        not null default 'es' check (locale ~ '^[a-z]{2}$'),
      sort_order    integer     not null default 0,
      published     boolean     not null default false,
      published_at  timestamptz,
      author_id     text,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    );
    create index help_center_articles_public_idx
      on help_center_articles (locale, sort_order, title) where published;
    create index help_center_articles_category_idx
      on help_center_articles (category);

    create table help_center_feedback (
      id          text        primary key,
      article_id  text        not null references help_center_articles(id) on delete cascade,
      voter_hash  text        not null check (char_length(voter_hash) between 8 and 128),
      helpful     boolean     not null,
      comment     text        check (char_length(comment) <= 500),
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now(),
      unique (article_id, voter_hash)
    );
    create index help_center_feedback_article_idx
      on help_center_feedback (article_id, created_at desc);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists help_center_feedback;
    drop table if exists help_center_articles;
  `.execute(db)
}
