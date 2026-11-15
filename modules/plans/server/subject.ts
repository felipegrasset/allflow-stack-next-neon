import type { Session } from "@/server/auth"

/**
 * Who subscribes in THIS app: the person (`session.user.id`). It is the
 * `subscriberRef` handed to `payments.startSubscription` and the `subject` of
 * `getPlan` / `can` / `limit` on /settings/plan.
 *
 * An app whose customer is the organization (B2B) changes this ONE function to
 * return the organization id, and calls the contracts with that same id.
 */
export function subjectOf(session: Session): string {
  return session.user.id
}
