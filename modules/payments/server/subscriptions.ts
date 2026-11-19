/**
 * Subscriptions: reads (which one entitles today, history) and the two
 * requests to the provider (cancel, change plan). Money rule, as with
 * refunds: the requests never change local state. The row changes when the
 * provider confirms it (webhook), through `applyEvent`.
 */
import type { Kysely, Selectable } from "kysely"
import { z } from "zod"

import type { Database } from "@/server/db/schema"

import {
  compareSubscriptions,
  pickActiveSubscription,
  subscriptionEntitles,
} from "../contracts/subscriptions"
import {
  OperationNotSupportedError,
  SubscriptionChangeError,
  type CancelSubscriptionResult,
  type CancelSubscriptionTarget,
  type ChangeSubscriptionPlanResult,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from "../contracts/types"
import type { PaymentsSubscriptionsTable } from "../db/types"

import type { CheckoutDeps } from "./checkout"
import { getProvider } from "./registry"

type Db = Kysely<Database>
type SubscriptionRow = Selectable<PaymentsSubscriptionsTable>

export type SubscriptionDeps = CheckoutDeps & { now?: () => Date }

/** Upper bound of `listSubscriptions` (a person has a handful, not thousands). */
export const LIST_SUBSCRIPTIONS_MAX = 100

export function toSubscriptionRecord(r: SubscriptionRow): SubscriptionRecord {
  return {
    id: r.id,
    provider: r.provider,
    externalId: r.external_id,
    subscriberRef: r.subscriber_ref,
    planRef: r.plan_ref,
    status: r.status as SubscriptionStatus,
    currentPeriodEnd: r.current_period_end,
    cancelAt: r.cancel_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const ref = z.string().trim().min(1).max(200)

/** Every subscription of a person, newest first (`created_at desc, id desc`), at most 100. */
export async function listSubscriptions(
  db: Db,
  subscriberRef: string
): Promise<SubscriptionRecord[]> {
  const rows = await db
    .selectFrom("payments_subscriptions")
    .selectAll()
    .where("subscriber_ref", "=", ref.parse(subscriberRef))
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(LIST_SUBSCRIPTIONS_MAX)
    .execute()
  return rows.map(toSubscriptionRecord)
}

/** The subscription that entitles the person now (rule: `contracts/subscriptions.ts`), or `null`. */
export async function getActiveSubscription(
  db: Db,
  subscriberRef: string,
  deps: { now?: () => Date } = {}
): Promise<SubscriptionRecord | null> {
  const now = (deps.now ?? (() => new Date()))()
  return pickActiveSubscription(await listSubscriptions(db, subscriberRef), now)
}

/**
 * The subscription a cancel/change by person acts on: the best one that the
 * provider still bills (`active` or `past_due`, period end not required).
 * Pure, for tests.
 */
export function pickBillable(
  subs: readonly SubscriptionRecord[],
  now: Date
): { sub: SubscriptionRecord } | { error: SubscriptionChangeError } {
  const billable = subs
    .filter((s) => s.status === "active" || s.status === "past_due")
    .sort(compareSubscriptions)
  if (billable[0]) return { sub: billable[0] }
  const canceled = subs.some(
    (s) => s.status === "canceled" && subscriptionEntitles(s, now)
  )
  return {
    error: new SubscriptionChangeError(
      canceled ? "already_canceled" : "not_found"
    ),
  }
}

/**
 * Asks the provider to cancel. `atPeriodEnd: true` keeps what was paid until
 * the end of the period (Paddle: `effective_from: next_billing_period`);
 * `false` cancels now (Paddle does NOT refund the unused part on its own).
 * Nothing local changes here: the provider's webhook brings `cancelAt` (when
 * scheduled) and later the `canceled` status.
 */
export async function cancelSubscription(
  db: Db,
  target: CancelSubscriptionTarget,
  opts: { atPeriodEnd: boolean },
  deps: SubscriptionDeps = {}
): Promise<CancelSubscriptionResult> {
  const env = deps.env ?? process.env
  const now = (deps.now ?? (() => new Date()))()
  let sub: SubscriptionRecord
  if ("subscriptionId" in target) {
    const row = await db
      .selectFrom("payments_subscriptions")
      .selectAll()
      .where("id", "=", ref.parse(target.subscriptionId))
      .executeTakeFirst()
    if (!row) throw new SubscriptionChangeError("not_found")
    sub = toSubscriptionRecord(row)
    if (sub.status === "canceled")
      throw new SubscriptionChangeError("already_canceled")
    if (sub.status === "pending") throw new SubscriptionChangeError("not_active")
  } else {
    const picked = pickBillable(
      await listSubscriptions(db, target.subscriberRef),
      now
    )
    if ("error" in picked) throw picked.error
    sub = picked.sub
  }
  const provider = await (deps.getProvider ?? getProvider)(sub.provider, env)
  if (!provider.cancelSubscription)
    throw new OperationNotSupportedError(provider.id, "cancelSubscription")
  const atPeriodEnd = opts.atPeriodEnd === true
  await provider.cancelSubscription(sub.externalId, { atPeriodEnd })
  return {
    subscriptionId: sub.id,
    externalId: sub.externalId,
    provider: sub.provider,
    atPeriodEnd,
  }
}

/**
 * Asks the provider to move the person's live subscription to `newPlanRef`.
 * Only `active` subscriptions (Paddle rejects changes on `past_due`). The new
 * `planRef` lands locally when the provider's webhook confirms it; until then
 * `getActiveSubscription` keeps reporting the old plan.
 */
export async function changeSubscriptionPlan(
  db: Db,
  subscriberRef: string,
  newPlanRef: string,
  deps: SubscriptionDeps = {}
): Promise<ChangeSubscriptionPlanResult> {
  const env = deps.env ?? process.env
  const now = (deps.now ?? (() => new Date()))()
  const plan = ref.parse(newPlanRef)
  const picked = pickBillable(await listSubscriptions(db, subscriberRef), now)
  if ("error" in picked) throw picked.error
  const sub = picked.sub
  if (sub.status !== "active") throw new SubscriptionChangeError("not_active")
  if (sub.planRef === plan) throw new SubscriptionChangeError("same_plan")
  const provider = await (deps.getProvider ?? getProvider)(sub.provider, env)
  if (!provider.changeSubscriptionPlan)
    throw new OperationNotSupportedError(provider.id, "changeSubscriptionPlan")
  const change = await provider.changeSubscriptionPlan(sub.externalId, plan)
  return {
    ...change,
    subscriptionId: sub.id,
    externalId: sub.externalId,
    provider: sub.provider,
    newPlanRef: plan,
  }
}
