/**
 * Pure domain of the plans module: types and the rules that turn "the
 * subscription that entitles a subject today" (payments.getActiveSubscription)
 * + "the plan catalog" into "what this subject may do", plus the rules of the
 * catalog editor (publishing, archiving, the single default plan) and of the
 * change / cancel buttons. No database, no network, no `@/` imports at runtime: the tests import
 * this file directly.
 *
 * MONEY IS INDIRECT HERE. Prices live in the payment provider; this module only
 * maps a provider plan id (`planRef`) to a set of entitlements. Every rule
 * below FAILS CLOSED: when in doubt, the subject gets the default plan (or
 * nothing), never a paid one.
 */

/** Plan and entitlement keys: lowercase, start with a letter, `[a-z0-9_.-]`, up to 64. */
export const KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/

export function isKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value)
}

/** Provider plan ids are opaque, but never spaces, quotes or control characters. */
export const PLAN_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,199}$/

export const ENTITLEMENT_KINDS = ["feature", "limit"] as const
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number]

/** Biggest limit storable and still exact as a JS number (bigint column, < 2^53). */
export const MAX_LIMIT = 1_000_000_000_000

export type Entitlement = {
  key: string
  kind: EntitlementKind
  /** Only meaningful for `feature`. */
  enabled: boolean
  /** Only meaningful for `limit`. `null` = unlimited. */
  limit: number | null
  labelEs: string | null
  labelEn: string | null
}

export type Plan = {
  id: string
  key: string
  nameEs: string
  nameEn: string
  descriptionEs: string | null
  descriptionEn: string | null
  /** Provider plan id this plan maps to (what `startSubscription` receives). `null` = cannot be bought. */
  planRef: string | null
  /** The plan of a subject with no granting subscription. At most one. */
  isDefault: boolean
  /**
   * Not archived. An archived plan is never offered, but it still applies to
   * whoever is already subscribed to it (nothing is taken away).
   */
  active: boolean
  /**
   * Offered for sale (0.2). Needs a `planRef` and `active`: see
   * `publishBlockers`. Unpublishing never takes the plan away from subscribers.
   */
  published: boolean
  /** Price TEXT to show next to the plan. Informational only: the real price lives in the provider. */
  priceNoteEs: string | null
  priceNoteEn: string | null
  sort: number
  entitlements: Entitlement[]
}

/**
 * The subscription facts this module needs, read through `payments/contracts`
 * (`getActiveSubscription`, camelCase `SubscriptionRecord`).
 */
export type SubscriptionSnapshot = {
  /** Local id in payments (`payments_subscriptions.id`). */
  id: string | null
  /** Payments provider id (`paddle`, `mercadopago`, `flow`). */
  provider: string | null
  status: string
  planRef: string | null
  currentPeriodEnd: Date | null
  /** Cancellation the provider confirmed and scheduled (`null` = none). */
  cancelAt: Date | null
}

/**
 * Where the plan came from:
 * - `subscription`: a granting subscription whose `planRef` maps to a plan.
 * - `default`: no granting subscription (or it maps to no plan): the default plan.
 * - `none`: and there is no default plan either. Every `can` is false, every `limit` 0.
 */
export type PlanSource = "subscription" | "default" | "none"

export type PlanResolution = {
  subject: string
  plan: Plan | null
  source: PlanSource
  /** The subscription that entitles the subject today, as payments reports it (or null). */
  subscription: (SubscriptionSnapshot & { grants: boolean }) | null
  /**
   * A granting subscription whose `planRef` matches NO plan of the catalog
   * (a provider plan nobody mapped). The subject got the default plan instead:
   * someone should map that `planRef`.
   */
  unmappedPlanRef: string | null
}

/**
 * Does this subscription grant its plan right now?
 * - `active` → yes. The provider is the source of truth: a renewal the app has
 *   not heard of yet must not cut a paying customer off.
 * - `past_due` → only until `currentPeriodEnd` (what was already paid for).
 * - `canceled` → only until `currentPeriodEnd` (paid until the end of the period).
 * - `pending` (checkout not paid) or anything unknown → no.
 */
export function subscriptionGrants(
  sub: SubscriptionSnapshot | null,
  now: Date
): boolean {
  if (!sub) return false
  if (sub.status === "active") return true
  if (sub.status === "past_due" || sub.status === "canceled") {
    const end = sub.currentPeriodEnd
    return end instanceof Date && !Number.isNaN(end.getTime()) && end.getTime() > now.getTime()
  }
  return false
}

export type ResolveDeps = {
  /**
   * The subscription that entitles `subject` TODAY (payments'
   * `getActiveSubscription`), never just "the latest one": a newer unpaid
   * `pending` checkout must not hide the active one. `resolvePlan` still
   * re-checks `subscriptionGrants` (fail closed if payments ever returns a
   * non-entitling row).
   */
  getSubscription(subject: string): Promise<SubscriptionSnapshot | null>
  findPlanByRef(planRef: string): Promise<Plan | null>
  findDefaultPlan(): Promise<Plan | null>
  now?: () => Date
}

/** The subject is the same `subscriberRef` that `payments.startSubscription` received. */
export function assertSubject(subject: unknown): asserts subject is string {
  if (typeof subject !== "string" || subject.trim() === "" || subject.length > 200)
    throw new TypeError("plans: subject must be a non-empty string (the payments subscriberRef)")
}

export async function resolvePlan(
  subject: string,
  deps: ResolveDeps
): Promise<PlanResolution> {
  assertSubject(subject)
  const now = (deps.now ?? (() => new Date()))()
  const sub = await deps.getSubscription(subject)
  const grants = subscriptionGrants(sub, now)
  const subscription = sub ? { ...sub, grants } : null

  let unmappedPlanRef: string | null = null
  if (grants && sub?.planRef) {
    const plan = await deps.findPlanByRef(sub.planRef)
    if (plan) return { subject, plan, source: "subscription", subscription, unmappedPlanRef }
    unmappedPlanRef = sub.planRef
  }
  const fallback = await deps.findDefaultPlan()
  return {
    subject,
    plan: fallback,
    source: fallback ? "default" : "none",
    subscription,
    unmappedPlanRef,
  }
}

function assertKey(key: unknown): asserts key is string {
  if (!isKey(key)) throw new TypeError(`plans: invalid entitlement key ${JSON.stringify(key)}`)
}

function entitlementOf(plan: Plan | null, key: string, kind: EntitlementKind) {
  return plan?.entitlements.find((e) => e.key === key && e.kind === kind)
}

/** Feature flag. Unknown feature, a `limit` key, or no plan → false. */
export function planCan(plan: Plan | null, feature: string): boolean {
  assertKey(feature)
  return entitlementOf(plan, feature, "feature")?.enabled === true
}

/**
 * Numeric limit. `Infinity` = unlimited (so `used < limit` just works).
 * Unknown key, a `feature` key, or no plan → 0.
 */
export function planLimit(plan: Plan | null, key: string): number {
  assertKey(key)
  const e = entitlementOf(plan, key, "limit")
  if (!e) return 0
  if (e.limit === null) return Number.POSITIVE_INFINITY
  return Number.isSafeInteger(e.limit) && e.limit >= 0 ? e.limit : 0
}

/**
 * Is there room for `adding` more, given `used`? Use it right before creating
 * the thing, on the server: `if (!hasRoom(limit, count)) throw …`.
 * Negative or non-integer input fails closed.
 */
export function hasRoom(limit: number, used: number, adding = 1): boolean {
  if (!Number.isInteger(used) || used < 0) return false
  if (!Number.isInteger(adding) || adding < 1) return false
  if (limit === Number.POSITIVE_INFINITY) return true
  return used + adding <= limit
}

/** Picks the plan text for a locale. */
export function planName(plan: Pick<Plan, "nameEs" | "nameEn">, locale: string): string {
  return locale === "en" ? plan.nameEn : plan.nameEs
}

export function planDescription(
  plan: Pick<Plan, "descriptionEs" | "descriptionEn">,
  locale: string
): string | null {
  return locale === "en" ? plan.descriptionEn : plan.descriptionEs
}

/** Informational price text for a locale (never the real price: that is the provider's). */
export function planPriceNote(
  plan: Pick<Plan, "priceNoteEs" | "priceNoteEn">,
  locale: string
): string | null {
  return locale === "en" ? plan.priceNoteEn : plan.priceNoteEs
}

export function entitlementLabel(e: Entitlement, locale: string): string {
  return (locale === "en" ? e.labelEn : e.labelEs) ?? e.key
}

// ── Catalog rules (the editor at /admin/plans) ───────────────────────────────

/** What keeps a plan from being published (sold). */
export type PublishBlocker = "archived" | "missing_plan_ref"

export function publishBlockers(plan: Pick<Plan, "active" | "planRef">): PublishBlocker[] {
  const out: PublishBlocker[] = []
  if (!plan.active) out.push("archived")
  if (!plan.planRef) out.push("missing_plan_ref")
  return out
}

/** Offered for sale right now: published, not archived and mapped to a provider plan. */
export function isSellable(plan: Pick<Plan, "active" | "planRef" | "published">): boolean {
  return plan.published && publishBlockers(plan).length === 0
}

/** Why a plan is not for sale yet, in the order the editor lists it. */
export type SaleIssue = PublishBlocker | "not_published"
/** Not blocking, but worth a look before selling. */
export type SaleWarning = "no_entitlements"

export function saleChecklist(
  plan: Pick<Plan, "active" | "planRef" | "published" | "entitlements">
): { sellable: boolean; missing: SaleIssue[]; warnings: SaleWarning[] } {
  const missing: SaleIssue[] = publishBlockers(plan)
  if (!plan.published) missing.push("not_published")
  const warnings: SaleWarning[] = plan.entitlements.length === 0 ? ["no_entitlements"] : []
  return { sellable: missing.length === 0, missing, warnings }
}

/**
 * Archiving the default plan needs ANOTHER, non-archived plan to become the
 * default in the same transaction (everyone without a subscription gets it).
 */
export type ArchiveProblem = "default_needs_replacement" | "replacement_invalid"

export function archiveProblem(
  plan: Pick<Plan, "id" | "isDefault">,
  replacement: Pick<Plan, "id" | "active"> | null
): ArchiveProblem | null {
  if (!plan.isDefault) return null
  if (!replacement) return "default_needs_replacement"
  if (replacement.id === plan.id || !replacement.active) return "replacement_invalid"
  return null
}

/** Only a non-archived plan can be the default. */
export function defaultProblem(target: Pick<Plan, "active">): "default_archived" | null {
  return target.active ? null : "default_archived"
}

// ── Change / cancel / subscribe (/settings/plan) ─────────────────────────────

/**
 * Providers whose adapter in payments implements `changeSubscriptionPlan` and
 * `cancelSubscription` (payments MODULE.md 0.2: Paddle only; Mercado Pago and
 * Flow throw `OperationNotSupportedError`). payments does not expose a
 * capability query, so this list mirrors its documentation; the Server
 * Actions still handle `OperationNotSupportedError` if it drifts.
 */
export const PLAN_CHANGE_PROVIDERS: readonly string[] = ["paddle"]
export const CANCEL_PROVIDERS: readonly string[] = ["paddle"]

/**
 * - `none`: nothing entitles the subject through a subscription → may subscribe.
 * - `manageable`: `active`, and the provider can change and/or cancel it.
 * - `cancel_scheduled`: `active` with a confirmed cancellation at period end.
 * - `past_due`: a charge failed; the provider rejects plan changes (cancel only).
 * - `ending`: `canceled`, paid period still running → may subscribe again.
 * - `unsupported`: `active` with a provider that cannot change or cancel from
 *   the app (Mercado Pago, Flow): the change is "cancel with the provider,
 *   then subscribe again".
 */
export type SubscriptionMode =
  | "none"
  | "manageable"
  | "cancel_scheduled"
  | "past_due"
  | "ending"
  | "unsupported"

export type SubscriptionOptions = {
  mode: SubscriptionMode
  canChange: boolean
  canCancel: boolean
  canSubscribe: boolean
}

export function subscriptionOptions(
  sub: (SubscriptionSnapshot & { grants: boolean }) | null
): SubscriptionOptions {
  const off = { canChange: false, canCancel: false, canSubscribe: false }
  if (!sub || !sub.grants) return { mode: "none", ...off, canSubscribe: true }
  if (sub.status === "canceled") return { mode: "ending", ...off, canSubscribe: true }
  const changeOk = sub.provider !== null && PLAN_CHANGE_PROVIDERS.includes(sub.provider)
  const cancelOk = sub.provider !== null && CANCEL_PROVIDERS.includes(sub.provider)
  if (sub.status === "past_due") return { mode: "past_due", ...off, canCancel: cancelOk && !sub.cancelAt }
  if (sub.status === "active") {
    if (sub.cancelAt) return { mode: "cancel_scheduled", ...off }
    if (!changeOk && !cancelOk) return { mode: "unsupported", ...off }
    return { mode: "manageable", ...off, canChange: changeOk, canCancel: cancelOk }
  }
  return { mode: "unsupported", ...off }
}

/** May the subject switch its live subscription to `target` from /settings/plan? */
export function canChangeTo(res: PlanResolution, target: Plan): boolean {
  const opts = subscriptionOptions(res.subscription)
  if (!opts.canChange || !isSellable(target)) return false
  if (target.planRef === res.subscription?.planRef) return false
  return res.plan?.id !== target.id
}

/**
 * May the subject START a new subscription to `target`? Only when nothing is
 * billing it anymore (`none` / `ending`): a second live subscription would be
 * charged twice. With a live one, the way is `canChangeTo`.
 */
export function canStartSubscription(res: PlanResolution, target: Plan): boolean {
  if (!subscriptionOptions(res.subscription).canSubscribe) return false
  if (!isSellable(target)) return false
  return res.plan?.id !== target.id
}

/** A change / cancel the subject asked for (plans_subscription_requests). */
export type RequestSnapshot = {
  kind: "change" | "cancel"
  subscriptionId: string
  fromPlanRef: string | null
  toPlanId: string | null
  toPlanRef: string | null
  atPeriodEnd: boolean | null
  requestedAt: Date
}

/** How long a request waits for the provider before the buttons come back. */
export const REQUEST_WAIT_MS = 30 * 60 * 1000

/**
 * The request still waiting for the provider, or `null` when it is confirmed
 * (the subscription now shows it), belongs to another subscription, or is
 * older than `REQUEST_WAIT_MS`. Display only: the plan always comes from
 * payments.
 */
export function pendingRequest(
  req: RequestSnapshot | null,
  sub: SubscriptionSnapshot | null,
  now: Date
): RequestSnapshot | null {
  if (!req) return null
  const age = now.getTime() - req.requestedAt.getTime()
  if (!(age >= 0 && age < REQUEST_WAIT_MS)) return null
  if (!sub || sub.id !== req.subscriptionId) return null
  if (req.kind === "change") return sub.planRef === req.toPlanRef ? null : req
  return sub.cancelAt || sub.status === "canceled" ? null : req
}
