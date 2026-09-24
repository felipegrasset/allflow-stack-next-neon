/**
 * server/rate-limit.ts against a real Postgres (needs DATABASE_URL and
 * `pnpm db:migrate`). What the in-memory version could not promise and this
 * one must: the count is shared, concurrent attempts on one key don't slip
 * past the limit, the window slides, and old rows are purged.
 *
 *   pnpm test:rate-limit
 */
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { sql } from "kysely"

import { consume } from "@/server/rate-limit"
import { getKysely } from "@/server/db/pool"

const rule = { max: 5, windowMs: 60_000 }
const key = () => `test:${randomUUID()}`

after(async () => {
  await sql`delete from rate_limit_hit where key like 'test:%'`.execute(getKysely())
  await getKysely().destroy()
})

test("5 pasan, el 6.º no, con retryAfter hasta que vence el primero", async () => {
  const k = key()
  const t0 = Date.now()
  for (let i = 0; i < 5; i++) assert.deepEqual(await consume(k, rule, t0 + i * 1000), { ok: true })
  const blocked = await consume(k, rule, t0 + 10_000)
  assert.deepEqual(blocked, { ok: false, retryAfter: 50 })
})

test("la ventana se desliza: vencido el primer intento, entra uno más", async () => {
  const k = key()
  const t0 = Date.now()
  for (let i = 0; i < 5; i++) await consume(k, rule, t0 + i * 1000)
  assert.equal((await consume(k, rule, t0 + 60_500)).ok, true)
  assert.equal((await consume(k, rule, t0 + 60_600)).ok, false)
})

test("concurrencia: 20 intentos a la vez sobre la misma clave → exactamente 5 pasan", async () => {
  const k = key()
  const now = Date.now()
  const results = await Promise.all(Array.from({ length: 20 }, () => consume(k, rule, now)))
  assert.equal(results.filter((r) => r.ok).length, 5)
})

test("claves distintas no se cuentan juntas", async () => {
  const [a, b] = [key(), key()]
  const now = Date.now()
  for (let i = 0; i < 5; i++) await consume(a, rule, now)
  assert.equal((await consume(a, rule, now)).ok, false)
  assert.equal((await consume(b, rule, now)).ok, true)
})

test("las filas de más de una hora se purgan en la misma llamada", async () => {
  const k = key()
  const old = Date.now() - 2 * 3_600_000
  await consume(k, rule, old)
  await consume(key(), rule, Date.now())
  const { rows } = await sql<{ n: number }>`select count(*)::int as n from rate_limit_hit where key = ${k}`.execute(getKysely())
  assert.equal(rows[0].n, 0)
})
