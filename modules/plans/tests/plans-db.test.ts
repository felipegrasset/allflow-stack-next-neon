/**
 * plans v0.2 against real Postgres: migrations 0125 + 0128, the seed (nothing
 * sellable), the catalog editor's store (publish, archive, one default,
 * plan_ref uniqueness) and the table checks that back it. Creates its own
 * schema and drops it at the end.
 *
 * Without DATABASE_URL it skips — and says so. NOT RUN on the machine where it
 * was written (no Postgres there).
 */
import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect, sql } from "kysely"
import pg from "pg"

import type { Database } from "@/server/db/schema"

import { PlansError } from "../contracts/errors"
import { up as up0125 } from "../db/migrations/0125_plans_init"
import { up as up0128 } from "../db/migrations/0128_plans_v02"
import { seed } from "../seed"
import * as store from "../server/store"

const url = process.env.DATABASE_URL
const skip = url ? false : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `plans_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  pool = new pg.Pool({ connectionString: url, max: 8 })
  pool.on("connect", (c) => void c.query(`set search_path to ${schema}`))
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await up0125(db as unknown as Kysely<unknown>)
  // A v0.1 catalog with the old invented ids, to check what 0128 does with it.
  await sql`
    insert into plans_plans (id, key, name_es, name_en, plan_ref, is_default, active, sort) values
      ('old-free', 'gratis', 'Gratis', 'Free', null, true, true, 0),
      ('old-pro', 'pro', 'Pro', 'Pro', 'ejemplo-plan-pro', false, true, 10),
      ('old-real', 'real', 'Real', 'Real', 'pri_real_1', false, true, 20)
  `.execute(db)
  await up0128(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await pool.query(`drop schema ${schema} cascade`)
  await pool.end()
})

const code = (c: string) => (err: unknown) => err instanceof PlansError && err.code === c

const fields = (over: Partial<Parameters<typeof store.updatePlan>[1]> = {}) => ({
  nameEs: "Plan",
  nameEn: "Plan",
  descriptionEs: null,
  descriptionEn: null,
  planRef: null,
  sort: 0,
  priceNoteEs: null,
  priceNoteEn: null,
  ...over,
})

test("0128 on a v0.1 catalog: invented ids cleared, real mapped plans stay for sale", { skip }, async () => {
  const pro = await store.findPlanById(db, "old-pro")
  assert.equal(pro?.planRef, null)
  assert.equal(pro?.published, false)
  const real = await store.findPlanById(db, "old-real")
  assert.equal(real?.published, true)
  const forSale = await store.listPlans(db, { scope: "published" })
  assert.deepEqual(forSale.map((p) => p.key), ["real"])
})

test("seed is idempotent and leaves nothing new for sale", { skip }, async () => {
  await seed(db)
  await seed(db)
  const all = await store.listPlans(db, { scope: "all" })
  assert.equal(all.filter((p) => p.isDefault).length, 1)
  assert.ok(all.some((p) => p.key === "equipo"))
  const forSale = await store.listPlans(db, { scope: "published" })
  assert.deepEqual(forSale.map((p) => p.key), ["real"], "only the plan an operator had mapped")
})

test("a new plan is a draft; publishing needs a plan_ref; a published plan keeps it", { skip }, async () => {
  const id = await store.createPlan(db, { key: "starter", ...fields({ nameEs: "Inicial", nameEn: "Starter" }) })
  assert.equal((await store.findPlanById(db, id))?.published, false)
  await assert.rejects(() => store.setPublished(db, id, true), code("ref_required"))
  await store.updatePlan(db, { planId: id, ...fields({ planRef: "pri_starter" }) })
  await store.setPublished(db, id, true)
  assert.equal((await store.findPlanById(db, id))?.published, true)
  await assert.rejects(() => store.updatePlan(db, { planId: id, ...fields({ planRef: null }) }), code("ref_required"))
  await assert.rejects(() => store.createPlan(db, { key: "starter", ...fields() }), code("key_taken"))
})

test("plan_ref is unique across plans", { skip }, async () => {
  const a = await store.createPlan(db, { key: "uniq_a", ...fields({ planRef: "pri_uniq" }) })
  const b = await store.createPlan(db, { key: "uniq_b", ...fields() })
  await assert.rejects(() => store.updatePlan(db, { planId: b, ...fields({ planRef: "pri_uniq" }) }), code("ref_taken"))
  await assert.rejects(() => store.createPlan(db, { key: "uniq_c", ...fields({ planRef: "pri_uniq" }) }), code("ref_taken"))
  await store.updatePlan(db, { planId: a, ...fields({ planRef: "pri_uniq" }) })
})

test("archive: unpublishes, keeps the plan for its subscribers, cannot be published", { skip }, async () => {
  const id = await store.createPlan(db, { key: "legacy", ...fields({ planRef: "pri_legacy" }) })
  await store.setPublished(db, id, true)
  await store.setArchived(db, id, true, null)
  const p = await store.findPlanById(db, id)
  assert.equal(p?.active, false)
  assert.equal(p?.published, false)
  assert.equal((await store.findPlanByRef(db, "pri_legacy"))?.id, id, "a subscriber still resolves to it")
  await assert.rejects(() => store.setPublished(db, id, true), code("not_subscribable"))
  await assert.rejects(() => store.setDefaultPlan(db, id), code("default_archived"))
  await store.setArchived(db, id, false, null)
  assert.equal((await store.findPlanById(db, id))?.published, false, "unarchive does not republish")
})

test("the default plan: archiving needs a replacement, applied atomically", { skip }, async () => {
  const def = await store.findDefaultPlan(db)
  assert.ok(def)
  await assert.rejects(() => store.setArchived(db, def.id, true, null), code("default_needs_replacement"))
  await assert.rejects(() => store.setArchived(db, def.id, true, def.id), code("replacement_invalid"))
  const next = await store.createPlan(db, { key: "free2", ...fields() })
  await store.setArchived(db, def.id, true, next)
  const all = await store.listPlans(db, { scope: "all" })
  assert.deepEqual(all.filter((p) => p.isDefault).map((p) => p.id), [next])
  assert.equal(all.find((p) => p.id === def.id)?.active, false)
  await store.setArchived(db, def.id, false, null)
  await store.setDefaultPlan(db, def.id)
})

test("two concurrent setDefaultPlan end with exactly one default", { skip }, async () => {
  const a = await store.createPlan(db, { key: "race_a", ...fields() })
  const b = await store.createPlan(db, { key: "race_b", ...fields() })
  await Promise.allSettled([store.setDefaultPlan(db, a), store.setDefaultPlan(db, b)])
  const all = await store.listPlans(db, { scope: "all" })
  assert.equal(all.filter((p) => p.isDefault).length, 1)
})

test("table checks back the rules even for raw SQL", { skip }, async () => {
  const id = await store.createPlan(db, { key: "raw", ...fields() })
  await assert.rejects(() => sql`update plans_plans set published = true where id = ${id}`.execute(db))
  const def = await store.findDefaultPlan(db)
  await assert.rejects(() => sql`update plans_plans set active = false where id = ${def?.id ?? ""}`.execute(db))
})

test("entitlements: a key keeps one kind; remove takes it off one plan only", { skip }, async () => {
  const a = await store.createPlan(db, { key: "ent_a", ...fields() })
  const b = await store.createPlan(db, { key: "ent_b", ...fields() })
  const base = { labelEs: null, labelEn: null }
  await store.setEntitlement(db, { planId: a, key: "seats_x", kind: "limit", enabled: false, limit: 3, ...base })
  await assert.rejects(
    () => store.setEntitlement(db, { planId: b, key: "seats_x", kind: "feature", enabled: true, limit: null, ...base }),
    code("kind_mismatch")
  )
  await store.setEntitlement(db, { planId: b, key: "seats_x", kind: "limit", enabled: false, limit: null, ...base })
  await store.removeEntitlement(db, a, "seats_x")
  assert.equal((await store.findPlanById(db, a))?.entitlements.length, 0)
  assert.equal((await store.findPlanById(db, b))?.entitlements.length, 1)
  await assert.rejects(() => store.removeEntitlement(db, a, "seats_x"), code("not_found"))
})

test("change / cancel requests: one row per subject, replaced", { skip }, async () => {
  const req = {
    kind: "change" as const,
    subscriptionId: "sub-1",
    fromPlanRef: "pri_a",
    toPlanId: null,
    toPlanRef: "pri_b",
    atPeriodEnd: null,
  }
  await store.saveRequest(db, "user-1", req)
  await store.saveRequest(db, "user-1", { ...req, kind: "cancel", toPlanRef: null, atPeriodEnd: true })
  const got = await store.getRequest(db, "user-1")
  assert.equal(got?.kind, "cancel")
  assert.equal(got?.atPeriodEnd, true)
  assert.equal(await store.getRequest(db, "nobody"), null)
})
