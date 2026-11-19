/**
 * discounts against real Postgres, with a FAKE orders port backed by a small
 * table of this test's schema (the real one is orders' contracts). The fake
 * keeps orders' rules for the discount hook: row lock, pending only, not
 * expired, no payment started, total ≥ 1. One test per money rule: amounts
 * from the stored order, the last use under concurrency, the per-person cap,
 * one use per order (replace / remove), all-or-nothing with orders, release
 * on cancel/expire (idempotent, concurrent), the sweep, and the triggers.
 * Creates its own schema and drops it at the end.
 *
 * Skipped without DATABASE_URL — and says so.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { after, before } from "node:test"

import { Kysely, PostgresDialect, sql } from "kysely"
import pg from "pg"

import { OrderError } from "@/modules/orders/contracts/types"
import type { Database } from "@/server/db/schema"

import { DiscountError, type DiscountErrorCode } from "../contracts/types"
import { up } from "../db/migrations/0127_discounts_init"
import type { DiscountsPorts, OrderView } from "../server/ports"
import { redeemCode, releaseForOrder, removeDiscount, sweepStale, toDiscountError } from "../server/redeem"
import { createCode, setActive } from "../server/store"

const url = process.env.DATABASE_URL
const skip = url ? false : "DATABASE_URL no está definida: estas pruebas necesitan Postgres"
const schema = `discounts_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

let pool: pg.Pool
let db: Kysely<Database>

before(async () => {
  if (skip) return
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`create schema ${schema}`)
  await admin.end()
  // search_path as a startup option, not an un-awaited query in a "connect" hook.
  pool = new pg.Pool({ connectionString: url, max: 12, options: `-c search_path=${schema},public` })
  db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  await pool.query(`
    create table fake_orders (
      id text primary key,
      user_id text not null,
      status text not null default 'pending',
      currency text not null,
      subtotal_minor bigint not null,
      discount_minor bigint not null default 0,
      total_minor bigint not null,
      discount_code text,
      discount_ref text,
      payment_started boolean not null default false,
      expires_at timestamptz not null,
      check (total_minor = subtotal_minor - discount_minor and total_minor >= 1)
    )`)
  await up(db as unknown as Kysely<unknown>)
})

after(async () => {
  if (skip) return
  await db.destroy()
  const admin = new pg.Pool({ connectionString: url, max: 1 })
  await admin.query(`drop schema ${schema} cascade`)
  await admin.end()
})

type Row = {
  id: string
  user_id: string
  status: string
  currency: string
  subtotal_minor: string
  discount_minor: string
  total_minor: string
  discount_code: string | null
  payment_started: boolean
  expires_at: Date
}
const toView = (r: Row): OrderView => ({
  id: r.id,
  userId: r.user_id,
  status: r.status as OrderView["status"],
  currency: r.currency,
  subtotalMinor: Number(r.subtotal_minor),
  discountMinor: Number(r.discount_minor),
  totalMinor: Number(r.total_minor),
  discountCode: r.discount_code,
  expiresAt: r.expires_at,
})

/** orders, faked on a table: same rules as orders' applyOrderDiscount. */
const ports: DiscountsPorts = {
  getOrder: async (id, d) => {
    const { rows } = await sql<Row>`select * from fake_orders where id = ${id}`.execute(d)
    return rows[0] ? toView(rows[0]) : null
  },
  applyOrderDiscount: async (id, input, d) => {
    const { rows } = await sql<Row>`select * from fake_orders where id = ${id} for update`.execute(d)
    const o = rows[0]
    if (!o) throw new OrderError("not_found")
    if (o.status !== "pending") throw new OrderError("invalid_status")
    if (o.expires_at.getTime() <= Date.now()) throw new OrderError("expired")
    if (o.payment_started) throw new OrderError("payment_started")
    const total = Number(o.subtotal_minor) - input.amountMinor
    if (input.amountMinor < 0 || total < 1) throw new OrderError("invalid_discount")
    const none = input.amountMinor === 0
    const { rows: fresh } = await sql<Row>`
      update fake_orders set discount_minor = ${input.amountMinor}, total_minor = ${total},
        discount_code = ${none ? null : input.code}, discount_ref = ${none ? null : input.ref}
      where id = ${id} returning *`.execute(d)
    return toView(fresh[0]!)
  },
}

async function newOrder(over: Partial<{ user: string; subtotal: number; currency: string; status: string; minutes: number }> = {}) {
  const id = randomUUID()
  const subtotal = over.subtotal ?? 17180
  await sql`insert into fake_orders (id, user_id, status, currency, subtotal_minor, total_minor, expires_at)
    values (${id}, ${over.user ?? "ana"}, ${over.status ?? "pending"}, ${over.currency ?? "CLP"}, ${subtotal}, ${subtotal},
      ${new Date(Date.now() + (over.minutes ?? 30) * 60_000)})`.execute(db)
  return id
}
const orderRow = async (id: string) => (await ports.getOrder(id, db))!
const setStatus = (id: string, status: string) => sql`update fake_orders set status = ${status} where id = ${id}`.execute(db)

let n = 0
async function newCode(over: Partial<Parameters<typeof createCode>[1]["data"]> = {}, active = true) {
  const code = `PRUEBA${++n}X`
  const id = await createCode(db, {
    code,
    active,
    createdBy: "ana",
    data: {
      kind: "percent",
      percentBp: 1000,
      amountMinor: null,
      currency: null,
      minSubtotalMinor: null,
      startsAt: null,
      endsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      note: null,
      ...over,
    },
  })
  return { id, code }
}
const activeUses = async (codeId: string) =>
  Number(
    (
      await sql<{ n: string }>`select count(*) as n from discounts_redemptions where code_id = ${codeId} and released_at is null`.execute(db)
    ).rows[0]!.n
  )
const isCode = (c: DiscountErrorCode) => (e: unknown) => toDiscountError(e) === c

test("rule 1: the amount comes from the stored order (percent rounded down) and is written on it", { skip }, async () => {
  const { id: codeId, code } = await newCode({ percentBp: 1250 })
  const orderId = await newOrder({ subtotal: 17180 })
  const r = await redeemCode(db, ports, { orderId, userId: "ana", code: `  ${code.toLowerCase()} ` })
  assert.equal(r.amountMinor, 2147)
  const o = await orderRow(orderId)
  assert.deepEqual([o.discountMinor, o.totalMinor, o.discountCode], [2147, 17180 - 2147, code])
  assert.equal(await activeUses(codeId), 1)
  // someone else's order: same answer as a missing one
  await assert.rejects(redeemCode(db, ports, { orderId, userId: "beto", code }), isCode("order_not_found"))
  // unknown and inactive codes answer the same
  await assert.rejects(redeemCode(db, ports, { orderId, userId: "ana", code: "NOEXISTE" }), isCode("invalid_code"))
  const off = await newCode({}, false)
  await assert.rejects(redeemCode(db, ports, { orderId, userId: "ana", code: off.code }), isCode("invalid_code"))
})

test("rule 3: the last use — of eight concurrent redemptions exactly one wins", { skip }, async () => {
  const { id: codeId, code } = await newCode({ maxUses: 1 })
  const orders = await Promise.all(Array.from({ length: 8 }, (_, i) => newOrder({ user: `u${i}` })))
  const results = await Promise.allSettled(orders.map((orderId, i) => redeemCode(db, ports, { orderId, userId: `u${i}`, code })))
  const ok = results.filter((r) => r.status === "fulfilled")
  assert.equal(ok.length, 1)
  for (const r of results)
    if (r.status === "rejected") assert.equal(toDiscountError(r.reason), "exhausted")
  assert.equal(await activeUses(codeId), 1)
  const discounted = await sql<{ n: string }>`select count(*) as n from fake_orders where discount_code = ${code}`.execute(db)
  assert.equal(Number(discounted.rows[0]!.n), 1, "only the winner's order got the discount")
})

test("rule 3: the per-person cap holds under concurrency too", { skip }, async () => {
  const { code } = await newCode({ maxUsesPerUser: 1 })
  const orders = await Promise.all(Array.from({ length: 5 }, () => newOrder({ user: "carla" })))
  const results = await Promise.allSettled(orders.map((orderId) => redeemCode(db, ports, { orderId, userId: "carla", code })))
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
  for (const r of results) if (r.status === "rejected") assert.equal(toDiscountError(r.reason), "user_limit")
  // another person still can
  await redeemCode(db, ports, { orderId: await newOrder({ user: "diego" }), userId: "diego", code })
})

test("rule 3: the trigger refuses an insert past the cap, whatever code path tries", { skip }, async () => {
  const { id: codeId, code } = await newCode({ maxUses: 1 })
  await redeemCode(db, ports, { orderId: await newOrder(), userId: "ana", code })
  await assert.rejects(
    sql`insert into discounts_redemptions (id, code_id, code, order_id, user_id, amount_minor, currency, subtotal_minor)
        values (${randomUUID()}, ${codeId}, ${code}, ${randomUUID()}, 'eva', 100, 'CLP', 1000)`.execute(db),
    (e: unknown) => e instanceof Error && /usage limit reached/.test(e.message)
  )
})

test("rule 4: one use per order — replacing is atomic and frees the old code", { skip }, async () => {
  const a = await newCode({ maxUses: 1 })
  const b = await newCode({ kind: "fixed", percentBp: null, amountMinor: 2000, currency: "CLP" })
  const orderId = await newOrder()
  await redeemCode(db, ports, { orderId, userId: "ana", code: a.code })
  const again = await redeemCode(db, ports, { orderId, userId: "ana", code: a.code })
  assert.equal(again.unchanged, true)
  const r = await redeemCode(db, ports, { orderId, userId: "ana", code: b.code })
  assert.equal(r.replaced, true)
  assert.equal(await activeUses(a.id), 0, "A was freed")
  assert.equal(await activeUses(b.id), 1)
  const o = await orderRow(orderId)
  assert.deepEqual([o.discountMinor, o.discountCode], [2000, b.code])
  const reasons = await sql<{ release_reason: string | null }>`
    select release_reason from discounts_redemptions where order_id = ${orderId} order by created_at`.execute(db)
  assert.deepEqual(reasons.rows.map((x) => x.release_reason), ["replaced", null])
  // A can be used again elsewhere (its only use was freed)
  await redeemCode(db, ports, { orderId: await newOrder({ user: "beto" }), userId: "beto", code: a.code })
  // the database refuses a second active use on one order
  await assert.rejects(
    sql`insert into discounts_redemptions (id, code_id, code, order_id, user_id, amount_minor, currency, subtotal_minor)
        values (${randomUUID()}, ${b.id}, ${b.code}, ${orderId}, 'ana', 100, 'CLP', 1000)`.execute(db)
  )
})

test("rule 4: removing the discount frees the use and restores the total", { skip }, async () => {
  const { id: codeId, code } = await newCode({ maxUses: 1 })
  const orderId = await newOrder({ subtotal: 5000 })
  await redeemCode(db, ports, { orderId, userId: "ana", code })
  await removeDiscount(db, ports, { orderId, userId: "ana" })
  const o = await orderRow(orderId)
  assert.deepEqual([o.discountMinor, o.totalMinor, o.discountCode], [0, 5000, null])
  assert.equal(await activeUses(codeId), 0)
  await assert.rejects(removeDiscount(db, ports, { orderId, userId: "ana" }), isCode("nothing_to_remove"))
})

test("rule 5: if orders refuses, the use is rolled back too", { skip }, async () => {
  const { id: codeId, code } = await newCode({ maxUses: 5 })
  const orderId = await newOrder()
  await sql`update fake_orders set payment_started = true where id = ${orderId}`.execute(db)
  await assert.rejects(redeemCode(db, ports, { orderId, userId: "ana", code }), (e: unknown) => {
    assert.ok(e instanceof OrderError && e.code === "payment_started")
    return toDiscountError(e) === "payment_started"
  })
  assert.equal(await activeUses(codeId), 0)
  const o = await orderRow(orderId)
  assert.equal(o.discountMinor, 0)
})

test("rule 4: cancel / expire frees the use — idempotent and safe in parallel", { skip }, async () => {
  const { id: codeId, code } = await newCode({ maxUses: 1 })
  const orderId = await newOrder()
  await redeemCode(db, ports, { orderId, userId: "ana", code })
  assert.deepEqual(await releaseForOrder(db, ports, orderId), { kind: "kept" }, "pending: kept")
  await setStatus(orderId, "canceled")
  const outs = await Promise.all(Array.from({ length: 5 }, () => releaseForOrder(db, ports, orderId)))
  assert.equal(outs.filter((o) => o.kind === "released").length, 1)
  assert.equal(outs.filter((o) => o.kind === "none").length, 4)
  assert.equal(await activeUses(codeId), 0)
  // a released use is never re-activated (trigger)
  await assert.rejects(sql`update discounts_redemptions set released_at = null, release_reason = null where order_id = ${orderId}`.execute(db))
})

test("rule 4: a stale use (expired order, not swept) does not block the last use", { skip }, async () => {
  const { code } = await newCode({ maxUses: 1 })
  const first = await newOrder()
  await redeemCode(db, ports, { orderId: first, userId: "ana", code })
  await setStatus(first, "expired")
  await redeemCode(db, ports, { orderId: await newOrder({ user: "beto" }), userId: "beto", code })
  const reason = await sql<{ release_reason: string | null }>`select release_reason from discounts_redemptions where order_id = ${first}`.execute(db)
  assert.equal(reason.rows[0]!.release_reason, "order_expired")
})

test("the sweep: releases closed orders, confirms paid ones, keeps pending ones", { skip }, async () => {
  const { code } = await newCode()
  const [p, c, e] = [await newOrder(), await newOrder(), await newOrder()]
  for (const id of [p, c, e]) await redeemCode(db, ports, { orderId: id, userId: "ana", code })
  await setStatus(p, "paid")
  await setStatus(c, "canceled")
  await setStatus(e, "expired")
  const report = await sweepStale(db, ports, { limit: 1000 })
  assert.equal(report.failed, 0)
  const rows = await sql<{ order_id: string; release_reason: string | null; confirmed_at: Date | null }>`
    select order_id, release_reason, confirmed_at from discounts_redemptions where order_id in (${p}, ${c}, ${e})`.execute(db)
  const by = new Map(rows.rows.map((r) => [r.order_id, r]))
  assert.ok(by.get(p)!.confirmed_at)
  assert.equal(by.get(c)!.release_reason, "order_canceled")
  assert.equal(by.get(e)!.release_reason, "order_expired")
  const again = await sweepStale(db, ports, { limit: 1000 })
  assert.equal(again.released, 0)
})

test("conditions on a real order: closed order, minimum, currency, deactivated code", { skip }, async () => {
  const min = await newCode({ kind: "fixed", percentBp: null, amountMinor: 2000, currency: "CLP", minSubtotalMinor: 15000 })
  await assert.rejects(redeemCode(db, ports, { orderId: await newOrder({ subtotal: 14999 }), userId: "ana", code: min.code }), isCode("below_minimum"))
  await assert.rejects(
    redeemCode(db, ports, { orderId: await newOrder({ currency: "USD" }), userId: "ana", code: min.code }),
    isCode("currency_mismatch")
  )
  await assert.rejects(redeemCode(db, ports, { orderId: await newOrder({ status: "paid" }), userId: "ana", code: min.code }), isCode("order_not_pending"))
  await assert.rejects(redeemCode(db, ports, { orderId: await newOrder({ minutes: -1 }), userId: "ana", code: min.code }), isCode("order_expired"))
  await setActive(db, min.id, false)
  await assert.rejects(redeemCode(db, ports, { orderId: await newOrder(), userId: "ana", code: min.code }), isCode("invalid_code"))
  await assert.rejects(createCode(db, { code: min.code, active: true, createdBy: null, data: { kind: "percent", percentBp: 500, amountMinor: null, currency: null, minSubtotalMinor: null, startsAt: null, endsAt: null, maxUses: null, maxUsesPerUser: null, note: null } }), (e: unknown) => e instanceof DiscountError && e.code === "code_taken")
})
