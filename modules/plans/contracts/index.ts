/**
 * Lo único que otro módulo (o la app) puede importar de `plans`. Todo es de
 * servidor: no lo llames desde un componente de cliente.
 *
 *   import { can, limit, getEntitlements } from "@/modules/plans/contracts"
 *
 *   if (!(await can(session.user.id, "export"))) forbidden()
 *
 *   const ent = await getEntitlements(session.user.id)   // una lectura, varias preguntas
 *   if (!ent.hasRoom("projects", currentCount)) return { ok: false, … }
 *
 * `subject` es el mismo `subscriberRef` con que se llamó
 * `startSubscription` de payments (el id de la persona o de la cuenta).
 *
 * Falla cerrado: sin suscripción que otorgue, el plan por defecto; sin plan por
 * defecto, nada (`can` → false, `limit` → 0). Una clave desconocida → false / 0.
 * Pregunta SIEMPRE en el servidor, justo antes de la acción: lo que muestre la
 * interfaz no protege nada.
 */
import { getActiveSubscription } from "@/modules/payments/contracts"
import { getKysely } from "@/server/db/pool"

import * as store from "../server/store"
import {
  hasRoom as roomFor,
  planCan,
  planLimit,
  resolvePlan,
  type Plan,
  type PlanResolution,
  type ResolveDeps,
  type SubscriptionSnapshot,
} from "./domain"
import type { Entitlements } from "./types"

/**
 * The subscription that entitles `subject` TODAY (payments' rule: an unpaid
 * `pending` checkout never hides the active one). Not `getSubscription`, which
 * returns the latest row in any state.
 */
async function readSubscription(subject: string): Promise<SubscriptionSnapshot | null> {
  const sub = await getActiveSubscription(subject)
  if (!sub) return null
  return {
    id: sub.id,
    provider: sub.provider,
    status: sub.status,
    planRef: sub.planRef,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAt: sub.cancelAt,
  }
}

const deps: ResolveDeps = {
  getSubscription: readSubscription,
  findPlanByRef: (planRef) => store.findPlanByRef(getKysely(), planRef),
  findDefaultPlan: () => store.findDefaultPlan(getKysely()),
}

/** The plan of `subject` and why (subscription / default / none). */
export function getPlan(subject: string): Promise<PlanResolution> {
  return resolvePlan(subject, deps)
}

/** Feature flag for `subject`. Unknown feature or no plan → false. */
export async function can(subject: string, feature: string): Promise<boolean> {
  return planCan((await getPlan(subject)).plan, feature)
}

/** Limit for `subject`. `Infinity` = unlimited; unknown key or no plan → 0. */
export async function limit(subject: string, key: string): Promise<number> {
  return planLimit((await getPlan(subject)).plan, key)
}

/** One read, then synchronous `can` / `limit` / `hasRoom` on the same plan. */
export async function getEntitlements(subject: string): Promise<Entitlements> {
  const res = await getPlan(subject)
  return {
    ...res,
    can: (feature) => planCan(res.plan, feature),
    limit: (key) => planLimit(res.plan, key),
    hasRoom: (key, used, adding = 1) => roomFor(planLimit(res.plan, key), used, adding),
  }
}

/**
 * The plans for sale, for a pricing page (published, not archived, with a
 * provider plan id; by `sort`). No prices: those live in the provider
 * (`priceNoteEs/En` is only an informational text).
 */
export function listPlans(): Promise<Plan[]> {
  return store.listPlans(getKysely(), { scope: "published" })
}

export {
  ENTITLEMENT_KINDS,
  KEY_PATTERN,
  entitlementLabel,
  hasRoom,
  isKey,
  isSellable,
  planCan,
  planDescription,
  planLimit,
  planName,
  planPriceNote,
  subscriptionGrants,
} from "./domain"
export type {
  Entitlement,
  EntitlementKind,
  Plan,
  PlanResolution,
  PlanSource,
  SubscriptionSnapshot,
} from "./domain"
export type { Entitlements } from "./types"
export { PlansError, type PlansErrorCode } from "./errors"
