import { sql, type Kysely } from "kysely"

/**
 * 0123 — courses: courses, lessons, enrollments and per-person progress.
 * `created_by` and `user_id` are user ids WITHOUT a foreign key on purpose
 * (the history survives the deletion of a user). Lessons, enrollments and
 * progress cascade with their course.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table courses_courses (
      id          text        primary key,
      title       text        not null check (length(title) between 1 and 160),
      summary     text        check (summary is null or length(summary) <= 300),
      description text        not null default '' check (length(description) <= 20000),
      status      text        not null default 'draft' check (status in ('draft', 'published')),
      created_by  text,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    create index courses_courses_status_idx on courses_courses (status, updated_at desc);

    create table courses_lessons (
      id          text        primary key,
      course_id   text        not null references courses_courses(id) on delete cascade,
      title       text        not null check (length(title) between 1 and 160),
      body        text        not null default '' check (length(body) <= 20000),
      position    integer     not null default 0 check (position between 0 and 9999),
      meeting_url text        check (meeting_url is null or (meeting_url like 'https://%' and length(meeting_url) <= 2000)),
      starts_at   timestamptz,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    create index courses_lessons_course_idx on courses_lessons (course_id, position, id);

    create table courses_enrollments (
      course_id   text        not null references courses_courses(id) on delete cascade,
      user_id     text        not null,
      enrolled_at timestamptz not null default now(),
      primary key (course_id, user_id)
    );
    create index courses_enrollments_user_idx on courses_enrollments (user_id);

    create table courses_progress (
      lesson_id    text        not null references courses_lessons(id) on delete cascade,
      user_id      text        not null,
      course_id    text        not null references courses_courses(id) on delete cascade,
      completed_at timestamptz not null default now(),
      primary key (lesson_id, user_id)
    );
    create index courses_progress_user_idx on courses_progress (user_id, course_id);
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists courses_progress;
    drop table if exists courses_enrollments;
    drop table if exists courses_lessons;
    drop table if exists courses_courses;
  `.execute(db)
}
