/**
 * Which subscription gives a person their plan today. Pure (no database, no
 * network): the rule lives here once, and `getActiveSubscription` applies it.
 *
 * A subscription ENTITLES right now when:
 *   - status `active` (the provider keeps billing; a renewal we have not heard
 *     of yet must not cut off a paying customer), or
 *   - status `past_due` or `canceled` with `currentPeriodEnd` strictly in the
 *     future (what was already paid for).
 * `pending` (checkout not paid) never entitles.
 *
 * Tie-break among several entitling ones (e.g. an old one canceled at period
 * end plus a new active one): `active` before `past_due` before `canceled`,
 * then the most recently created, then the greater `id` (deterministic).
 */
import type { SubscriptionRecord, SubscriptionStatus } from "./types"

type Entitling = Pick<SubscriptionRecord, "status" | "currentPeriodEnd">

export function subscriptionEntitles(sub: Entitling, now: Date): boolean {
  if (sub.status === "active") return true
  if (sub.status === "past_due" || sub.status === "canceled") {
    const end = sub.currentPeriodEnd
    return (
      end instanceof Date &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() > now.getTime()
    )
  }
  return false
}

const RANK: Record<SubscriptionStatus, number> = {
  active: 0,
  past_due: 1,
  canceled: 2,
  pending: 3,
}

type Ranked = Pick<SubscriptionRecord, "status" | "createdAt" | "id">

/** Sort order of the tie-break above (best first). */
export function compareSubscriptions(a: Ranked, b: Ranked): number {
  return (
    RANK[a.status] - RANK[b.status] ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  )
}

/** The subscription that entitles `now`, or `null`. */
export function pickActiveSubscription<
  T extends Entitling & Ranked,
>(subs: readonly T[], now: Date): T | null {
  const ok = subs.filter((s) => subscriptionEntitles(s, now))
  ok.sort(compareSubscriptions)
  return ok[0] ?? null
}
