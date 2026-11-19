/**
 * payments — listing, without a database: the cursor round-trips, a foreign
 * cursor is rejected instead of trusted, and the input is bounded. What needs
 * Postgres (filters, no skipped or repeated rows under equal `created_at`)
 * is listed in MODULE.md as not covered yet.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  decodeCursor,
  encodeCursor,
  LIST_PAYMENTS_DEFAULT_LIMIT,
  LIST_PAYMENTS_MAX_LIMIT,
  listPaymentsInputSchema,
} from "../contracts/list"

test("cursor: round-trips with microsecond precision", () => {
  const cursor = { createdAt: "2026-11-14T21:52:03.123456Z", id: "pay_1" }
  assert.deepEqual(decodeCursor(encodeCursor(cursor)), cursor)
})

test("cursor: anything this module did not issue decodes to null", () => {
  const b64 = (v: unknown) =>
    Buffer.from(JSON.stringify(v), "utf8").toString("base64url")
  for (const bad of [
    "",
    "not-base64-json",
    b64({ createdAt: "2026-11-14T21:52:03.123456Z", id: "x" }),
    b64(["2026-11-14T21:52:03.123Z", "x"]), // milliseconds only
    b64(["2026-11-14T21:52:03.123456Z'; drop table payments;--", "x"]),
    b64(["2026-11-14T21:52:03.123456Z", ""]),
    b64(["2026-11-14T21:52:03.123456Z", 7]),
    b64(["2026-11-14T21:52:03.123456Z", "x", "extra"]),
    "A".repeat(500),
  ]) {
    assert.equal(decodeCursor(bad), null, bad.slice(0, 40))
  }
})

test("input: limit defaults and is bounded; filters are closed lists", () => {
  assert.equal(listPaymentsInputSchema.parse({}).limit, LIST_PAYMENTS_DEFAULT_LIMIT)
  assert.equal(
    listPaymentsInputSchema.safeParse({ limit: LIST_PAYMENTS_MAX_LIMIT + 1 }).success,
    false
  )
  assert.equal(listPaymentsInputSchema.safeParse({ limit: 0 }).success, false)
  assert.equal(listPaymentsInputSchema.safeParse({ limit: 1.5 }).success, false)
  assert.equal(listPaymentsInputSchema.safeParse({ status: "paid" }).success, false)
  assert.equal(listPaymentsInputSchema.safeParse({ provider: "stripe" }).success, false)
  assert.equal(
    listPaymentsInputSchema.safeParse({
      status: "needs_review",
      provider: "flow",
      environment: "production",
    }).success,
    true
  )
})
