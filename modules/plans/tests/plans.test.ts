/**
 * plans v0.2 — what runs without a database: the grant rules, the resolution
 * with injected dependencies (fail closed at every step, and a pending
 * checkout never takes a plan away), the catalog rules (publishing, archiving,
 * one default), which change / cancel / subscribe actions are offered by
 * provider and status, the pending-request notice, can / limit / hasRoom, the
 * input schemas, the catalog (es/en parity), seed, manifest and, reading the
 * code, the guards of every Server Action.
 * Relative imports only, so it also runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { pickActiveSubscription } from "../../payments/contracts/subscriptions"
import {
  archiveProblem,
  canChangeTo,
  canStartSubscription,
  defaultProblem,
  hasRoom,
  isSellable,
  pendingRequest,
  planCan,
  planLimit,
  publishBlockers,
  resolvePlan,
  saleChecklist,
  subscriptionGrants,
  subscriptionOptions,
  REQUEST_WAIT_MS,
  type Plan,
  type RequestSnapshot,
  type ResolveDeps,
  type SubscriptionSnapshot,
} from "../contracts/domain"
import { PLANS_ERROR_CODES, SUBSCRIPTION_CHANGE_ERRORS } from "../contracts/errors"
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  createPlanSchema,
  planIdSchema,
  setArchivedSchema,
  setEntitlementSchema,
  setPlanRefSchema,
  setPublishedSchema,
  updatePlanSchema,
} from "../contracts/input"
import { en, es } from "../messages"
import { nav } from "../nav"
import { permissions } from "../permissions"
import { EXAMPLE_PLANS } from "../seed"

const DIR = join(process.cwd(), "modules/plans")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

const NOW = new Date("2026-11-14T12:00:00Z")
const LATER = new Date("2026-12-14T12:00:00Z")
const EARLIER = new Date("2026-10-14T12:00:00Z")

function plan(over: Partial<Plan> & Pick<Plan, "id" | "key">): Plan {
  return {
    nameEs: over.key,
    nameEn: over.key,
    descriptionEs: null,
    descriptionEn: null,
    planRef: null,
    isDefault: false,
    active: true,
    published: false,
    priceNoteEs: null,
    priceNoteEn: null,
    sort: 0,
    entitlements: [],
    ...over,
  }
}

function snap(over: Partial<SubscriptionSnapshot> & Pick<SubscriptionSnapshot, "status">): SubscriptionSnapshot {
  return {
    id: "sub-1",
    provider: "paddle",
    planRef: "ref_pro",
    currentPeriodEnd: null,
    cancelAt: null,
    ...over,
  }
}

const FREE = plan({
  id: "p-free",
  key: "free",
  isDefault: true,
  entitlements: [
    { key: "projects", kind: "limit", enabled: false, limit: 1, labelEs: null, labelEn: null },
    { key: "export", kind: "feature", enabled: false, limit: null, labelEs: null, labelEn: null },
  ],
})
const PRO = plan({
  id: "p-pro",
  key: "pro",
  planRef: "ref_pro",
  published: true,
  entitlements: [
    { key: "projects", kind: "limit", enabled: false, limit: null, labelEs: null, labelEn: null },
    { key: "export", kind: "feature", enabled: true, limit: null, labelEs: null, labelEn: null },
  ],
})
const TEAM = plan({ id: "p-team", key: "team", planRef: "ref_team", published: true })

function deps(sub: SubscriptionSnapshot | null, catalog: Plan[] = [FREE, PRO, TEAM]): ResolveDeps {
  return {
    getSubscription: async () => sub,
    findPlanByRef: async (ref) => catalog.find((p) => p.planRef === ref) ?? null,
    findDefaultPlan: async () => catalog.find((p) => p.isDefault) ?? null,
    now: () => NOW,
  }
}

// ── grant rules ──────────────────────────────────────────────────────────────

test("subscriptionGrants: active always; past_due/canceled only until the period end; pending never", () => {
  const s = (status: string, end: Date | null = null) => snap({ status, currentPeriodEnd: end })
  assert.equal(subscriptionGrants(null, NOW), false)
  assert.equal(subscriptionGrants(s("active"), NOW), true)
  assert.equal(subscriptionGrants(s("active", EARLIER), NOW), true)
  assert.equal(subscriptionGrants(s("past_due", LATER), NOW), true)
  assert.equal(subscriptionGrants(s("past_due", EARLIER), NOW), false)
  assert.equal(subscriptionGrants(s("past_due"), NOW), false)
  assert.equal(subscriptionGrants(s("canceled", LATER), NOW), true)
  assert.equal(subscriptionGrants(s("canceled", EARLIER), NOW), false)
  assert.equal(subscriptionGrants(s("pending", LATER), NOW), false)
  assert.equal(subscriptionGrants(s("trialing", LATER), NOW), false)
  assert.equal(subscriptionGrants(s("canceled", new Date("nope")), NOW), false)
  assert.equal(subscriptionGrants(s("canceled", NOW), NOW), false, "the end instant itself no longer grants")
})

// ── resolution ───────────────────────────────────────────────────────────────

test("an active subscription maps to its plan", async () => {
  const r = await resolvePlan("u1", deps(snap({ status: "active", currentPeriodEnd: LATER })))
  assert.equal(r.source, "subscription")
  assert.equal(r.plan?.key, "pro")
  assert.equal(r.subscription?.grants, true)
  assert.equal(r.unmappedPlanRef, null)
})

test("THE v0.1 BUG: a newer unpaid (pending) checkout does not take the paid plan away", async () => {
  // What payments.getActiveSubscription does over the subject's rows.
  const rows = [
    { id: "s-new", status: "pending" as const, planRef: "ref_team", currentPeriodEnd: null, createdAt: LATER },
    { id: "s-old", status: "active" as const, planRef: "ref_pro", currentPeriodEnd: LATER, createdAt: EARLIER },
  ]
  const picked = pickActiveSubscription(rows, NOW)
  assert.equal(picked?.id, "s-old")
  const r = await resolvePlan(
    "u1",
    deps(picked ? snap({ id: picked.id, status: picked.status, planRef: picked.planRef }) : null)
  )
  assert.equal(r.plan?.key, "pro")
  assert.equal(r.source, "subscription")
})

test("contracts/index reads getActiveSubscription, never getSubscription", () => {
  const src = read("contracts/index.ts")
  assert.match(src, /getActiveSubscription\(subject\)/)
  assert.doesNotMatch(src, /import \{[^}]*\bgetSubscription\b[^}]*\} from "@\/modules\/payments/)
  for (const f of ["server/actions.ts", "server/admin-actions.ts", "ui/page.tsx", "ui/admin-page.tsx"])
    assert.doesNotMatch(read(f), /\bgetSubscription\(/, f)
})

test("no subscription → default plan; no default either → none", async () => {
  const r = await resolvePlan("u1", deps(null))
  assert.equal(r.source, "default")
  assert.equal(r.plan?.key, "free")
  const none = await resolvePlan("u1", deps(null, [PRO]))
  assert.equal(none.source, "none")
  assert.equal(none.plan, null)
})

test("defense in depth: a pending row that still reaches resolvePlan gives nothing paid", async () => {
  const r = await resolvePlan("u1", deps(snap({ status: "pending" })))
  assert.equal(r.source, "default")
  assert.equal(r.plan?.key, "free")
  assert.equal(r.subscription?.grants, false)
})

test("a lapsed past_due / canceled subscription falls back to the default plan", async () => {
  for (const status of ["past_due", "canceled"]) {
    const r = await resolvePlan("u1", deps(snap({ status, currentPeriodEnd: EARLIER })))
    assert.equal(r.plan?.key, "free", status)
  }
})

test("a paid subscription with an unmapped planRef gets the default plan and is flagged", async () => {
  const r = await resolvePlan("u1", deps(snap({ status: "active", planRef: "ref_ghost" })))
  assert.equal(r.source, "default")
  assert.equal(r.unmappedPlanRef, "ref_ghost")
})

test("archived or unpublished plans still apply to whoever already pays for them", async () => {
  for (const p of [{ ...PRO, active: false, published: false }, { ...PRO, published: false }]) {
    const r = await resolvePlan("u1", deps(snap({ status: "active" }), [FREE, p]))
    assert.equal(r.plan?.key, "pro")
  }
})

test("resolvePlan rejects an empty subject before reading anything", async () => {
  let touched = false
  const d = { ...deps(null), getSubscription: async () => ((touched = true), null) }
  await assert.rejects(() => resolvePlan("", d), TypeError)
  await assert.rejects(() => resolvePlan("   ", d), TypeError)
  assert.equal(touched, false)
})

// ── catalog rules ────────────────────────────────────────────────────────────

test("publishing: needs a plan_ref and not being archived; sellable = published + no blockers", () => {
  assert.deepEqual(publishBlockers({ active: true, planRef: "x" }), [])
  assert.deepEqual(publishBlockers({ active: true, planRef: null }), ["missing_plan_ref"])
  assert.deepEqual(publishBlockers({ active: false, planRef: null }), ["archived", "missing_plan_ref"])
  assert.equal(isSellable(PRO), true)
  assert.equal(isSellable({ ...PRO, published: false }), false)
  assert.equal(isSellable({ ...PRO, active: false }), false)
  assert.equal(isSellable({ ...PRO, planRef: null }), false)
})

test("saleChecklist says what each plan still needs, and warns about an empty plan", () => {
  assert.deepEqual(saleChecklist(PRO), { sellable: true, missing: [], warnings: [] })
  const draft = plan({ id: "d", key: "draft" })
  assert.deepEqual(saleChecklist(draft), {
    sellable: false,
    missing: ["missing_plan_ref", "not_published"],
    warnings: ["no_entitlements"],
  })
  assert.deepEqual(saleChecklist({ ...PRO, active: false, published: false }).missing, ["archived", "not_published"])
})

test("archiving: the default plan needs another non-archived plan as replacement", () => {
  assert.equal(archiveProblem(PRO, null), null, "a non-default plan archives freely")
  assert.equal(archiveProblem(FREE, null), "default_needs_replacement")
  assert.equal(archiveProblem(FREE, FREE), "replacement_invalid")
  assert.equal(archiveProblem(FREE, { ...PRO, active: false }), "replacement_invalid")
  assert.equal(archiveProblem(FREE, PRO), null)
})

test("only a non-archived plan can be the default", () => {
  assert.equal(defaultProblem({ active: true }), null)
  assert.equal(defaultProblem({ active: false }), "default_archived")
})

test("store: default swap and archive are one transaction with row locks", () => {
  const src = read("server/store.ts")
  const fn = (name: string) => src.slice(src.indexOf(`export async function ${name}(`)).split(/\nexport async function /)[0]
  const setDefault = fn("setDefaultPlan")
  assert.match(setDefault, /db\.transaction\(\)\.execute/)
  assert.ok(setDefault.indexOf("lockPlan") < setDefault.indexOf("is_default: false"))
  assert.ok(setDefault.indexOf("is_default: false") < setDefault.indexOf("is_default: true"), "unset before set")
  const archive = fn("setArchived")
  assert.match(archive, /db\.transaction\(\)\.execute/)
  assert.match(archive, /archiveProblem\(/)
  assert.match(archive, /active: false, published: false/)
  assert.doesNotMatch(src, /deleteFrom\("plans_plans"\)/, "no hard delete of plans in v0.2")
  for (const name of ["createPlan", "updatePlan", "setPublished", "setEntitlement", "removeEntitlement"])
    assert.match(fn(name), /\.transaction\(\)\.execute/, name)
})

test("migration 0128: table checks back the rules", () => {
  const src = read("db/migrations/0128_plans_v02.ts")
  assert.match(src, /check \(not published or \(plan_ref is not null and active\)\)/)
  assert.match(src, /check \(not is_default or active\)/)
  assert.match(src, /plan_ref = null where plan_ref like 'ejemplo-plan-%'/)
})

// ── change / cancel / subscribe ──────────────────────────────────────────────

const g = (s: SubscriptionSnapshot) => ({ ...s, grants: subscriptionGrants(s, NOW) })

test("subscriptionOptions: what is offered by provider and status", () => {
  assert.deepEqual(subscriptionOptions(null), { mode: "none", canChange: false, canCancel: false, canSubscribe: true })
  assert.deepEqual(subscriptionOptions(g(snap({ status: "pending" }))).mode, "none")
  assert.deepEqual(subscriptionOptions(g(snap({ status: "active" }))), {
    mode: "manageable",
    canChange: true,
    canCancel: true,
    canSubscribe: false,
  })
  assert.deepEqual(subscriptionOptions(g(snap({ status: "active", cancelAt: LATER }))), {
    mode: "cancel_scheduled",
    canChange: false,
    canCancel: false,
    canSubscribe: false,
  })
  assert.deepEqual(subscriptionOptions(g(snap({ status: "past_due", currentPeriodEnd: LATER }))), {
    mode: "past_due",
    canChange: false,
    canCancel: true,
    canSubscribe: false,
  })
  assert.deepEqual(subscriptionOptions(g(snap({ status: "canceled", currentPeriodEnd: LATER }))), {
    mode: "ending",
    canChange: false,
    canCancel: false,
    canSubscribe: true,
  })
  for (const provider of ["mercadopago", "flow", null]) {
    assert.deepEqual(subscriptionOptions(g(snap({ status: "active", provider }))), {
      mode: "unsupported",
      canChange: false,
      canCancel: false,
      canSubscribe: false,
    }, String(provider))
    assert.equal(subscriptionOptions(g(snap({ status: "past_due", provider, currentPeriodEnd: LATER }))).canCancel, false)
  }
})

test("canChangeTo: live Paddle subscription, sellable target, not the same plan", async () => {
  const paying = await resolvePlan("u1", deps(snap({ status: "active" })))
  assert.equal(canChangeTo(paying, TEAM), true)
  assert.equal(canChangeTo(paying, PRO), false, "same plan")
  assert.equal(canChangeTo(paying, { ...TEAM, published: false }), false, "draft")
  assert.equal(canChangeTo(paying, { ...TEAM, active: false }), false, "archived")
  const mp = await resolvePlan("u1", deps(snap({ status: "active", provider: "mercadopago" })))
  assert.equal(canChangeTo(mp, TEAM), false, "provider cannot change")
  const free = await resolvePlan("u1", deps(null))
  assert.equal(canChangeTo(free, TEAM), false, "nothing to change")
})

test("canStartSubscription: only when nothing is billing anymore, and only sellable plans", async () => {
  const onFree = await resolvePlan("u1", deps(null))
  assert.equal(canStartSubscription(onFree, PRO), true)
  assert.equal(canStartSubscription(onFree, FREE), false, "not sellable")
  assert.equal(canStartSubscription(onFree, { ...PRO, published: false }), false, "draft")
  const paying = await resolvePlan("u1", deps(snap({ status: "active" })))
  assert.equal(canStartSubscription(paying, TEAM), false, "would be charged twice")
  const mp = await resolvePlan("u1", deps(snap({ status: "active", provider: "flow", planRef: "ref_ghost" })))
  assert.equal(canStartSubscription(mp, TEAM), false, "unsupported provider: cancel first")
  const ending = await resolvePlan("u1", deps(snap({ status: "canceled", currentPeriodEnd: LATER })))
  assert.equal(canStartSubscription(ending, TEAM), true, "canceled: may buy again")
  assert.equal(canStartSubscription(ending, PRO), false, "not the plan it already has")
})

test("pendingRequest: shown until the provider confirms, for that subscription, for a while", () => {
  const sub = snap({ status: "active" })
  const req: RequestSnapshot = {
    kind: "change",
    subscriptionId: "sub-1",
    fromPlanRef: "ref_pro",
    toPlanId: "p-team",
    toPlanRef: "ref_team",
    atPeriodEnd: null,
    requestedAt: new Date(NOW.getTime() - 60_000),
  }
  assert.equal(pendingRequest(req, sub, NOW), req, "not confirmed yet: the plan shown is still the real one")
  assert.equal(pendingRequest(req, { ...sub, planRef: "ref_team" }, NOW), null, "confirmed by webhook")
  assert.equal(pendingRequest(req, { ...sub, id: "sub-2" }, NOW), null, "another subscription")
  assert.equal(pendingRequest(req, null, NOW), null)
  assert.equal(pendingRequest({ ...req, requestedAt: new Date(NOW.getTime() - REQUEST_WAIT_MS) }, sub, NOW), null)
  assert.equal(pendingRequest({ ...req, requestedAt: new Date(NOW.getTime() + 60_000) }, sub, NOW), null)
  const cancel = { ...req, kind: "cancel" as const, toPlanId: null, toPlanRef: null, atPeriodEnd: true }
  assert.equal(pendingRequest(cancel, sub, NOW), cancel)
  assert.equal(pendingRequest(cancel, { ...sub, cancelAt: LATER }, NOW), null)
  assert.equal(pendingRequest(cancel, { ...sub, status: "canceled" }, NOW), null)
  assert.equal(pendingRequest(null, sub, NOW), null)
})

test("every SubscriptionChangeError code of payments maps to a translated code", () => {
  for (const [from, to] of Object.entries(SUBSCRIPTION_CHANGE_ERRORS)) {
    assert.ok((PLANS_ERROR_CODES as readonly string[]).includes(to), from)
    assert.ok(es.plans.errors[to], to)
  }
  assert.deepEqual(Object.keys(SUBSCRIPTION_CHANGE_ERRORS).sort(), ["already_canceled", "not_active", "not_found", "same_plan"])
})

// ── can / limit / hasRoom ────────────────────────────────────────────────────

test("planCan: enabled feature only; unknown key, limit key or no plan → false", () => {
  assert.equal(planCan(PRO, "export"), true)
  assert.equal(planCan(FREE, "export"), false)
  assert.equal(planCan(PRO, "unknown_feature"), false)
  assert.equal(planCan(PRO, "projects"), false, "a limit is not a feature")
  assert.equal(planCan(null, "export"), false)
  assert.throws(() => planCan(PRO, "Bad Key"), TypeError)
})

test("planLimit: number, Infinity for unlimited, 0 when unknown / feature / no plan", () => {
  assert.equal(planLimit(FREE, "projects"), 1)
  assert.equal(planLimit(PRO, "projects"), Number.POSITIVE_INFINITY)
  assert.equal(planLimit(PRO, "seats"), 0)
  assert.equal(planLimit(PRO, "export"), 0)
  assert.equal(planLimit(null, "projects"), 0)
})

test("hasRoom: used + adding <= limit, Infinity always, bad input fails closed", () => {
  assert.equal(hasRoom(1, 0), true)
  assert.equal(hasRoom(1, 1), false)
  assert.equal(hasRoom(3, 1, 2), true)
  assert.equal(hasRoom(Number.POSITIVE_INFINITY, 1_000_000), true)
  assert.equal(hasRoom(10, -1), false)
  assert.equal(hasRoom(10, 1.5), false)
  assert.equal(hasRoom(10, 0, 0), false)
  assert.equal(hasRoom(10, Number.NaN), false)
})

// ── input schemas ────────────────────────────────────────────────────────────

const PLAN_FIELDS = {
  nameEs: "Pro",
  nameEn: "Pro",
  descriptionEs: "",
  descriptionEn: null,
  planRef: " pri_01h ",
  sort: 10,
  priceNoteEs: "US$19 al mes",
  priceNoteEn: "",
}

test("createPlanSchema / updatePlanSchema: trims, empties become null, no price field", () => {
  const c = createPlanSchema.parse({ key: " Pro ", ...PLAN_FIELDS })
  assert.equal(c.key, "pro")
  assert.equal(c.planRef, "pri_01h")
  assert.equal(c.descriptionEs, null)
  assert.equal(c.descriptionEn, null)
  assert.equal(c.priceNoteEn, null)
  assert.equal(createPlanSchema.parse({ key: "pro", ...PLAN_FIELDS, planRef: "" }).planRef, null)
  assert.equal("price" in c || "amount" in c, false)
  const u = updatePlanSchema.parse({ planId: "p", ...PLAN_FIELDS, key: "ignored" })
  assert.equal("key" in u, false, "the key is fixed once created")
  for (const bad of [
    { key: "1pro", ...PLAN_FIELDS },
    { key: "pro", ...PLAN_FIELDS, nameEs: "  " },
    { key: "pro", ...PLAN_FIELDS, planRef: "a b" },
    { key: "pro", ...PLAN_FIELDS, sort: 1.5 },
    { key: "pro", ...PLAN_FIELDS, sort: Number.NaN },
    { key: "pro", ...PLAN_FIELDS, priceNoteEs: "x".repeat(61) },
  ])
    assert.equal(createPlanSchema.safeParse(bad).success, false, JSON.stringify(bad))
})

test("status schemas: publish, archive (+replacement), change and cancel", () => {
  assert.equal(setPublishedSchema.safeParse({ planId: "p", published: "yes" }).success, false)
  assert.equal(setArchivedSchema.parse({ planId: "p", archived: true }).newDefaultPlanId, null)
  assert.equal(setArchivedSchema.parse({ planId: "p", archived: true, newDefaultPlanId: "q" }).newDefaultPlanId, "q")
  assert.equal(cancelSubscriptionSchema.parse({}).atPeriodEnd, true, "at period end by default")
  assert.equal(cancelSubscriptionSchema.parse({ atPeriodEnd: false }).atPeriodEnd, false)
  assert.equal(changePlanSchema.safeParse({ planId: "" }).success, false)
  assert.equal(planIdSchema.safeParse({ planId: "" }).success, false)
})

test("setEntitlementSchema normalizes kind-specific fields and rejects bad values", () => {
  const f = setEntitlementSchema.parse({ planId: "p", key: " Export ", kind: "feature", enabled: true, limit: 5 })
  assert.equal(f.key, "export")
  assert.equal(f.limit, null)
  const l = setEntitlementSchema.parse({ planId: "p", key: "projects", kind: "limit", enabled: true, limit: 10, labelEs: "" })
  assert.equal(l.enabled, false)
  assert.equal(l.labelEs, null)
  for (const bad of [
    { planId: "p", key: "projects", kind: "limit", limit: -1 },
    { planId: "p", key: "projects", kind: "limit", limit: Number.NaN },
    { planId: "p", key: "projects", kind: "limit", limit: 1e13 },
    { planId: "p", key: "pro jects", kind: "feature" },
    { planId: "p", key: "export", kind: "price" },
  ])
    assert.equal(setEntitlementSchema.safeParse(bad).success, false, JSON.stringify(bad))
})

test("setPlanRefSchema: empty unmaps; no spaces, quotes or control characters", () => {
  assert.equal(setPlanRefSchema.parse({ planId: "p", planRef: "  " }).planRef, null)
  assert.equal(setPlanRefSchema.parse({ planId: "p", planRef: "pri_01h:abc-1" }).planRef, "pri_01h:abc-1")
  for (const bad of ["a b", "x'y", "x\"y", "a\nb", "-x"])
    assert.equal(setPlanRefSchema.safeParse({ planId: "p", planRef: bad }).success, false, bad)
})

// ── catalog, permissions, nav, seed, manifest ────────────────────────────────

function keysOf(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix]
  return Object.entries(o).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}
function argsOf(s: string): string[] {
  return [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()
}
function leaves(o: unknown, prefix = ""): [string, string][] {
  if (typeof o === "string") return [[prefix, o]]
  return Object.entries(o as object).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

test("es and en have the same keys, no empty text, the same ICU arguments and no ICU quotes", () => {
  assert.deepEqual(keysOf(en).sort(), keysOf(es).sort())
  assert.deepEqual(Object.keys(es), ["plans"])
  const enMap = new Map(leaves(en))
  for (const [k, v] of leaves(es)) {
    assert.ok(v.trim() !== "", `empty es ${k}`)
    assert.ok(enMap.get(k)?.trim(), `empty en ${k}`)
    assert.deepEqual(argsOf(enMap.get(k) ?? ""), argsOf(v), k)
    assert.doesNotMatch(v + (enMap.get(k) ?? ""), /['<>]/, k)
  }
})

test("every error code has a text", () => {
  for (const code of PLANS_ERROR_CODES) assert.ok(es.plans.errors[code], code)
})

test("plan:manage is owner/admin only and opens /admin", () => {
  assert.deepEqual(permissions.statement, { plan: ["manage"] })
  assert.deepEqual(permissions.adminAccess, { plan: ["manage"] })
  assert.equal("grants" in permissions, false)
})

test("nav: /settings/plan for everyone signed in, /admin/plans for plan:manage", () => {
  assert.deepEqual(nav, [
    { href: "/settings/plan", label: "plans.nav", area: "settings" },
    { href: "/admin/plans", label: "plans.navAdmin", area: "admin", permission: { plan: ["manage"] } },
  ])
  for (const item of nav) assert.ok(es.plans[item.label.split(".")[1] as "nav" | "navAdmin"], item.label)
})

test("seed: nothing sellable — one free default, paid examples are drafts without plan_ref", () => {
  assert.equal(EXAMPLE_PLANS.filter((p) => p.isDefault).length, 1)
  assert.equal(new Set(EXAMPLE_PLANS.map((p) => p.key)).size, EXAMPLE_PLANS.length)
  for (const p of EXAMPLE_PLANS) {
    assert.equal(p.planRef, null, p.key)
    assert.equal(p.published, false, p.key)
  }
  const kinds = new Map<string, string>()
  for (const p of EXAMPLE_PLANS)
    for (const e of p.entitlements) {
      assert.equal(kinds.get(e.key) ?? e.kind, e.kind, e.key)
      kinds.set(e.key, e.kind)
    }
  assert.doesNotMatch(read("seed.ts"), /ejemplo-plan/)
})

test("manifest 0.2.0: both migrations, both routes, the new table, dependsOn payments", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "plans")
  assert.equal(m.version, "0.2.0")
  assert.deepEqual(m.migrations, ["0125_plans_init", "0128_plans_v02"])
  assert.deepEqual(m.dependsOn, ["payments"])
  assert.deepEqual(m.tables, ["plans_plans", "plans_entitlements", "plans_subscription_requests"])
  assert.deepEqual(m.routes, [
    { path: "/settings/plan", entry: "ui/page.tsx" },
    { path: "/admin/plans", entry: "ui/admin-page.tsx" },
  ])
})

// ── reading the code ─────────────────────────────────────────────────────────

function bodies(src: string): [string, string][] {
  const names = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  return names.map((n) => [n, src.slice(src.indexOf(`export async function ${n}(`)).split(/\nexport async function /)[0]])
}
function firstOf(body: string, tokens: string[]): number {
  return Math.min(
    ...tokens.map((t) => {
      const i = body.indexOf(t)
      return i === -1 ? Number.POSITIVE_INFINITY : i
    })
  )
}

test("admin actions: session + plan:manage, then Zod, then the store", () => {
  const src = read("server/admin-actions.ts")
  const actions = bodies(src)
  assert.deepEqual(actions.map(([n]) => n).sort(), [
    "createPlanAction",
    "removeEntitlementAction",
    "setArchivedAction",
    "setDefaultPlanAction",
    "setEntitlementAction",
    "setPublishedAction",
    "updatePlanAction",
  ])
  for (const [name, body] of actions) {
    const guard = body.indexOf("managerOnly()")
    const zod = body.indexOf(".safeParse(")
    const data = firstOf(body, ["store."])
    assert.ok(guard > -1 && guard < zod && zod < data, `${name}: guard → Zod → store`)
  }
  assert.match(src, /async function managerOnly[\s\S]*requireOnboardedUser[\s\S]*canManagePlans/)
})

test("user actions: session first, Zod, only a plan id from the browser, payments by contract", () => {
  const src = read("server/actions.ts")
  const actions = bodies(src)
  assert.deepEqual(actions.map(([n]) => n).sort(), ["cancelSubscriptionAction", "changePlanAction", "subscribeAction"])
  for (const [name, body] of actions) {
    const guard = body.indexOf("requireOnboardedUser(")
    const zod = body.indexOf(".safeParse(")
    const data = firstOf(body, ["store.", "getPlan(", "startSubscription(", "changeSubscriptionPlan(", "cancelSubscription("])
    assert.ok(guard > -1 && guard < zod && zod < data, `${name}: session → Zod → data`)
  }
  assert.match(src, /export async function subscribeAction\(planId: string\)/)
  assert.match(src, /export async function changePlanAction\(planId: string\)/)
  assert.match(src, /changeSubscriptionPlan\(subject, target\.planRef\)/)
  assert.match(src, /cancelSubscription\(\{ subscriberRef: subject \}/)
  assert.match(src, /instanceof OperationNotSupportedError/)
  assert.match(src, /instanceof SubscriptionChangeError/)
  assert.doesNotMatch(src, /amount/i)
})

test("the admin page checks plan:manage itself (not just the /admin door)", () => {
  const src = read("ui/admin-page.tsx")
  assert.match(src, /if \(!\(await canManagePlans\(\)\)\) forbidden\(\)/)
  assert.doesNotMatch(src, /requireAdmin\(/)
})

test("payments is used only through its contracts", () => {
  for (const f of [
    "contracts/index.ts",
    "contracts/errors.ts",
    "server/actions.ts",
    "server/admin-actions.ts",
    "server/store.ts",
    "ui/page.tsx",
    "ui/admin-page.tsx",
    "seed.ts",
  ]) {
    const src = read(f)
    for (const m of src.matchAll(/from "@\/modules\/payments([^"]*)"/g)) assert.equal(m[1], "/contracts", f)
    assert.doesNotMatch(src, /payments_subscriptions|selectFrom\("payments/, f)
  }
})
