import { sql, type Kysely } from "kysely"

/**
 * 0128 — plans v0.2: real, editable plans.
 *
 * - `published`: the plan is OFFERED for sale. A plan is sold only when it is
 *   published, which needs a provider plan id (`plan_ref`) and not being
 *   archived (`active`). Before 0.2 "active + plan_ref" meant "for sale"; the
 *   example plans of the 0.1 seed carried invented ids (`ejemplo-plan-…`), so
 *   those ids are cleared here and every other active plan with a `plan_ref`
 *   stays for sale (published).
 * - `price_note_es` / `price_note_en`: a price TEXT to show next to the plan.
 *   Informational only: the real price and the charge live in the provider.
 * - The default plan cannot be archived (it is what everyone without a
 *   subscription gets).
 * - `plans_subscription_requests`: the last change / cancel a subject asked the
 *   provider for, so /settings/plan can say "requested, waiting for the
 *   provider" after a reload. It never decides a plan: that is always
 *   `payments.getActiveSubscription`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table plans_plans
      add column published     boolean not null default false,
      add column price_note_es text check (price_note_es is null or length(price_note_es) between 1 and 60),
      add column price_note_en text check (price_note_en is null or length(price_note_en) between 1 and 60);

    update plans_plans set plan_ref = null where plan_ref like 'ejemplo-plan-%';
    update plans_plans set published = true where active and plan_ref is not null;
    -- A default plan that 0.1 left archived becomes active again (it was applied anyway).
    update plans_plans set active = true where is_default and not active;

    alter table plans_plans
      add constraint plans_plans_published_needs_ref_ck
        check (not published or (plan_ref is not null and active)),
      add constraint plans_plans_default_active_ck
        check (not is_default or active);

    create table plans_subscription_requests (
      subject          text        primary key check (length(subject) between 1 and 200),
      kind             text        not null check (kind in ('change', 'cancel')),
      subscription_id  text        not null,
      from_plan_ref    text,
      to_plan_id       text        references plans_plans(id) on delete set null,
      to_plan_ref      text,
      at_period_end    boolean,
      requested_at     timestamptz not null default now()
    );
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists plans_subscription_requests;
    alter table plans_plans
      drop constraint if exists plans_plans_default_active_ck,
      drop constraint if exists plans_plans_published_needs_ref_ck,
      drop column if exists price_note_en,
      drop column if exists price_note_es,
      drop column if exists published;
  `.execute(db)
}
