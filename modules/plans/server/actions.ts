"use server"

import { revalidatePath } from "next/cache"

import type { FormResult } from "@/lib/schemas/auth"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import {
  OperationNotSupportedError,
  SubscriptionChangeError,
  cancelSubscription,
  changeSubscriptionPlan,
  startSubscription,
} from "@/modules/payments/contracts"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { getPlan } from "../contracts"
import {
  canChangeTo,
  canStartSubscription,
  isSellable,
  pendingRequest,
  subscriptionOptions,
} from "../contracts/domain"
import { PlansError, SUBSCRIPTION_CHANGE_ERRORS, type PlansErrorCode } from "../contracts/errors"
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  planIdSchema,
  type CancelSubscriptionInput,
} from "../contracts/input"
import { es } from "../messages"
import { safeLog } from "./log"
import { SETTINGS_PATH } from "./paths"
import { fail } from "./result"
import * as store from "./store"
import { subjectOf } from "./subject"

/**
 * What a signed-in person does with THEIR subscription on /settings/plan.
 * The browser sends ONLY a plan id (or "at period end"): the provider plan id
 * comes from the catalog, the subject from the session, the price from the
 * provider. Change and cancel only ASK the provider (payments): the plan shown
 * changes when the provider confirms by webhook, never because we asked.
 */

/** payments errors → our codes. Never the raw message (it can carry provider details). */
function providerCode(err: unknown): PlansErrorCode {
  if (err instanceof PlansError) return err.code
  if (err instanceof OperationNotSupportedError) return "provider_unsupported"
  if (err instanceof SubscriptionChangeError) return SUBSCRIPTION_CHANGE_ERRORS[err.code]
  return "provider_error"
}

/** Starts the provider's hosted checkout. Returns its absolute https URL in `redirectTo`. */
export async function subscribeAction(planId: string): Promise<FormResult<"planId">> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  const parsed = planIdSchema.safeParse({ planId })
  if (!parsed.success) return fail("invalid_input")
  const subject = subjectOf(session)
  try {
    const [plan, current] = await Promise.all([
      store.findPlanById(getKysely(), parsed.data.planId),
      getPlan(subject),
    ])
    if (!plan) return fail("not_found")
    if (!subscriptionOptions(current.subscription).canSubscribe) return fail("already_subscribed")
    if (!plan.planRef || !canStartSubscription(current, plan)) return fail("not_subscribable")
    const { url } = await startSubscription({
      subscriberRef: subject,
      planRef: plan.planRef,
      returnPath: SETTINGS_PATH,
    })
    if (!isHttpsUrl(url)) return fail("provider_error")
    return { ok: true, redirectTo: url }
  } catch (err) {
    safeLog("subscribe", err)
    return fail(providerCode(err))
  }
}

/**
 * Asks the provider to switch the live subscription to `planId` (Paddle:
 * prorated and charged or credited right away). Remembers the request so the
 * page can say "requested, waiting for the provider".
 */
export async function changePlanAction(planId: string): Promise<FormResult<"planId">> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  const parsed = changePlanSchema.safeParse({ planId })
  if (!parsed.success) return fail("invalid_input")
  const subject = subjectOf(session)
  try {
    const db = getKysely()
    const [target, current, request] = await Promise.all([
      store.findPlanById(db, parsed.data.planId),
      getPlan(subject),
      store.getRequest(db, subject),
    ])
    if (!target) return fail("not_found")
    const sub = current.subscription
    if (pendingRequest(request, sub, new Date())) return fail("request_pending")
    const opts = subscriptionOptions(sub)
    if (opts.mode === "unsupported") return fail("provider_unsupported")
    if (!opts.canChange || !sub?.id) return fail("not_changeable")
    if (!target.planRef || !isSellable(target)) return fail("not_subscribable")
    if (!canChangeTo(current, target)) return fail("sub_same_plan")
    const res = await changeSubscriptionPlan(subject, target.planRef)
    await store.saveRequest(db, subject, {
      kind: "change",
      subscriptionId: res.subscriptionId,
      fromPlanRef: sub.planRef,
      toPlanId: target.id,
      toPlanRef: res.newPlanRef,
      atPeriodEnd: null,
    })
  } catch (err) {
    safeLog("changePlan", err)
    return fail(providerCode(err))
  }
  revalidatePath(SETTINGS_PATH)
  const copy = await getModuleCopy(es)
  return { ok: true, message: copy.change.requested }
}

/** Asks the provider to cancel the live subscription (at period end by default). */
export async function cancelSubscriptionAction(
  values: CancelSubscriptionInput
): Promise<FormResult<keyof CancelSubscriptionInput>> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  const parsed = cancelSubscriptionSchema.safeParse(values)
  if (!parsed.success) return fail("invalid_input")
  const subject = subjectOf(session)
  try {
    const db = getKysely()
    const [current, request] = await Promise.all([getPlan(subject), store.getRequest(db, subject)])
    const sub = current.subscription
    if (pendingRequest(request, sub, new Date())) return fail("request_pending")
    const opts = subscriptionOptions(sub)
    if (opts.mode === "unsupported") return fail("provider_unsupported")
    if (!opts.canCancel || !sub?.id) return fail("not_changeable")
    const res = await cancelSubscription({ subscriberRef: subject }, { atPeriodEnd: parsed.data.atPeriodEnd })
    await store.saveRequest(db, subject, {
      kind: "cancel",
      subscriptionId: res.subscriptionId,
      fromPlanRef: sub.planRef,
      toPlanId: null,
      toPlanRef: null,
      atPeriodEnd: res.atPeriodEnd,
    })
  } catch (err) {
    safeLog("cancelSubscription", err)
    return fail(providerCode(err))
  }
  revalidatePath(SETTINGS_PATH)
  const copy = await getModuleCopy(es)
  return { ok: true, message: copy.cancel.requested }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}
