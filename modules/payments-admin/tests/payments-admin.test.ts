/**
 * payments-admin — the rules that decide money, without database or network:
 * amount parsing, the refund decision, the return page lookup, the safe
 * redirect and the log allow-list. Everything that talks to `payments` goes
 * through its contracts and is covered by payments' own tests.
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { PAYMENT_STATUSES, PROVIDER_IDS } from "../../payments/contracts/types"
import { paymentAdminHref, paymentDetailHref, paymentReturnPath } from "../contracts"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { adminLogLine, errorName } from "../server/log"
import {
  decideRefund,
  FILTER_PROVIDERS,
  FILTER_STATUSES,
  listHref,
  parseListParams,
  parseMajorAmount,
  refundableMinor,
  resolveReturnLookup,
  returnRateLimits,
  RETURN_IP_RULE,
  RETURN_TARGET_RULE,
  returnOutcome,
  safeInternalPath,
  type RefundableRecord,
} from "../server/logic"

const rec = (over: Partial<RefundableRecord> = {}): RefundableRecord => ({
  id: "pay-1",
  status: "approved",
  amountMinor: 15000,
  refundedMinor: 0,
  ...over,
})

// ── amounts ──────────────────────────────────────────────────────────────────

test("parseMajorAmount: CLP takes whole pesos and rejects any separator", () => {
  assert.deepEqual(parseMajorAmount("1990", 0), { ok: true, minor: 1990 })
  assert.deepEqual(parseMajorAmount(" 1990 ", 0), { ok: true, minor: 1990 })
  // "1.990" is ambiguous (es-CL thousands vs en-US decimals): refused.
  assert.deepEqual(parseMajorAmount("1.990", 0), { ok: false, error: "decimals" })
  assert.deepEqual(parseMajorAmount("1,990", 0), { ok: false, error: "decimals" })
})

test("parseMajorAmount: USD with comma or dot, no float error", () => {
  assert.deepEqual(parseMajorAmount("15,5", 2), { ok: true, minor: 1550 })
  assert.deepEqual(parseMajorAmount("15.50", 2), { ok: true, minor: 1550 })
  assert.deepEqual(parseMajorAmount("0.29", 2), { ok: true, minor: 29 }) // 0.29*100 = 28.999… in float
  assert.deepEqual(parseMajorAmount("1.005", 2), { ok: false, error: "decimals" })
})

test("parseMajorAmount: rejects junk, zero, negatives and thousands separators", () => {
  for (const bad of ["", "abc", "-5", "1 000", "1.000,50", "1e3", "12.", ".5", "0x10"])
    assert.equal(parseMajorAmount(bad, 2).ok, false, bad)
  assert.deepEqual(parseMajorAmount("0", 0), { ok: false, error: "zero" })
  assert.deepEqual(parseMajorAmount("0,00", 2), { ok: false, error: "zero" })
  assert.deepEqual(parseMajorAmount("999999999999999", 2), { ok: false, error: "too_large" })
})

// ── refund decision ──────────────────────────────────────────────────────────

test("refundableMinor: only an approved payment has something to refund", () => {
  assert.equal(refundableMinor(rec()), 15000)
  assert.equal(refundableMinor(rec({ refundedMinor: 5000 })), 10000)
  for (const status of ["pending", "failed", "refunded", "canceled", "needs_review"] as const)
    assert.equal(refundableMinor(rec({ status })), 0, status)
})

test("decideRefund: full refund of an untouched payment goes without amount", () => {
  assert.deepEqual(decideRefund({ record: rec(), paymentId: "pay-1", expectedRefundedMinor: 0 }), {
    ok: true,
    amountArg: undefined,
    refundMinor: 15000,
  })
})

test("decideRefund: partial and 'the rest' go with an explicit amount", () => {
  assert.deepEqual(
    decideRefund({ record: rec(), paymentId: "pay-1", expectedRefundedMinor: 0, requestedMinor: 4000 }),
    { ok: true, amountArg: 4000, refundMinor: 4000 }
  )
  assert.deepEqual(
    decideRefund({ record: rec({ refundedMinor: 4000 }), paymentId: "pay-1", expectedRefundedMinor: 4000 }),
    { ok: true, amountArg: 11000, refundMinor: 11000 }
  )
})

test("decideRefund: never more than what is left, never on a non-approved payment", () => {
  const d = (over: Parameters<typeof decideRefund>[0]) => decideRefund(over)
  assert.deepEqual(d({ record: rec(), paymentId: "pay-1", expectedRefundedMinor: 0, requestedMinor: 15001 }), {
    ok: false,
    error: "exceeds",
  })
  assert.deepEqual(d({ record: rec(), paymentId: "pay-1", expectedRefundedMinor: 0, requestedMinor: 0 }), {
    ok: false,
    error: "exceeds",
  })
  assert.deepEqual(d({ record: rec(), paymentId: "pay-1", expectedRefundedMinor: 0, requestedMinor: 1.5 }), {
    ok: false,
    error: "exceeds",
  })
  for (const status of ["pending", "failed", "refunded", "canceled", "needs_review"] as const)
    assert.deepEqual(d({ record: rec({ status }), paymentId: "pay-1", expectedRefundedMinor: 0 }), {
      ok: false,
      error: "not_approved",
    })
})

test("decideRefund: a stale page or another payment of the order is refused", () => {
  assert.deepEqual(
    decideRefund({ record: rec({ refundedMinor: 5000 }), paymentId: "pay-1", expectedRefundedMinor: 0 }),
    { ok: false, error: "stale" }
  )
  assert.deepEqual(decideRefund({ record: rec(), paymentId: "pay-OLD", expectedRefundedMinor: 0 }), {
    ok: false,
    error: "not_found",
  })
  assert.deepEqual(decideRefund({ record: null, paymentId: "pay-1", expectedRefundedMinor: 0 }), {
    ok: false,
    error: "not_found",
  })
})

// ── return page ──────────────────────────────────────────────────────────────

test("resolveReturnLookup: order first, with the provider reference alongside", () => {
  assert.deepEqual(resolveReturnLookup({ order: "42", payment_id: "123456789" }), {
    kind: "order",
    orderId: "42",
    providerRef: "123456789",
  })
  assert.deepEqual(resolveReturnLookup({ order: ["42", "43"] }), { kind: "order", orderId: "42", providerRef: undefined })
})

test("resolveReturnLookup: Mercado Pago's external_reference only with a payment id's shape", () => {
  const uuid = "3f1c2a4e-9b7d-4c1e-8a2f-0d9e8b7c6a5f"
  assert.deepEqual(resolveReturnLookup({ external_reference: uuid, payment_id: "987" }), {
    kind: "payment",
    paymentId: uuid,
    providerRef: "987",
  })
  assert.deepEqual(resolveReturnLookup({ external_reference: "drop table" }), { kind: "none" })
  assert.deepEqual(resolveReturnLookup({}), { kind: "none" })
})

test("resolveReturnLookup: odd provider references are dropped, not forwarded", () => {
  for (const bad of ["null", "a b", "x".repeat(201), "<script>", "../../x"]) {
    const l = resolveReturnLookup({ order: "42", payment_id: bad })
    assert.equal(l.kind === "order" && l.providerRef, undefined, bad)
  }
  assert.deepEqual(resolveReturnLookup({ order: "x".repeat(201) }), { kind: "none" })
})

test("returnOutcome: needs_review is 'review' for the payer, nothing more", () => {
  assert.equal(returnOutcome("needs_review"), "review")
  assert.equal(returnOutcome("approved"), "approved")
  assert.equal(returnOutcome(null), "unknown")
})

test("safeInternalPath: no open redirects", () => {
  assert.equal(safeInternalPath("/orders/42"), "/orders/42")
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/a b", undefined])
    assert.equal(safeInternalPath(bad), "/", String(bad))
})

test("paymentReturnPath: an internal path payments accepts as returnPath", () => {
  const p = paymentReturnPath("pedido 42/a", "/orders/42")
  assert.match(p, /^\/(?![/\\])[^\s\\]*$/) // payments' INTERNAL_PATH
  const u = new URL(p, "https://app.example")
  assert.equal(u.pathname, "/pago/retorno")
  assert.equal(u.searchParams.get("order"), "pedido 42/a")
  assert.equal(u.searchParams.get("next"), "/orders/42")
  assert.equal(paymentAdminHref("42"), "/admin/payments?order=42")
  assert.equal(paymentDetailHref("a/b c"), "/admin/payments/a%2Fb%20c")
})

// ── PAY-4: logs ──────────────────────────────────────────────────────────────

test("adminLogLine: allow-list only, error by name, never its message", () => {
  const e = new Error("card 4111 1111 1111 1111 rejected")
  e.name = "ProviderApiError"
  const line = adminLogLine(
    { action: "refund", outcome: "error", paymentId: "pay-1", error: errorName(e), ...({ body: "secret" } as object) },
    new Date("2026-11-14T00:00:00Z")
  )
  const parsed = JSON.parse(line)
  assert.deepEqual(Object.keys(parsed).sort(), ["action", "at", "error", "outcome", "paymentId", "scope"])
  assert.equal(parsed.error, "ProviderApiError")
  assert.doesNotMatch(line, /4111|secret/)
})

test("no route to approve or simulate a payment, and no direct table access", () => {
  const root = join(process.cwd(), "modules/payments-admin") // run from the repo root
  const files: string[] = []
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx|json)$/.test(f) && !p.includes(join(root, "tests"))) files.push(p)
    }
  }
  walk(root)
  for (const f of files) {
    const src = readFileSync(f, "utf8")
    assert.doesNotMatch(src, /applyEvent|selectFrom\(|updateTable\(|insertInto\(|getKysely/, f)
    assert.doesNotMatch(src, /modules\/payments\/(?!contracts)/, f)
  }
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
    routes: { path: string }[]
  }
  assert.deepEqual(
    manifest.routes.map((r) => r.path).sort(),
    ["/admin/payments", "/admin/payments/[id]", "/pago/retorno"]
  )
})

// ── list filters ─────────────────────────────────────────────────────────────

test("filter lists match payments' own (no stale status or provider)", () => {
  assert.deepEqual([...FILTER_STATUSES].sort(), [...PAYMENT_STATUSES].sort())
  assert.deepEqual([...FILTER_PROVIDERS].sort(), [...PROVIDER_IDS].sort())
})

test("parseListParams: known values pass, anything else is dropped", () => {
  assert.deepEqual(
    parseListParams({ status: "needs_review", provider: "flow", environment: "production", cursor: "abc" }),
    { filters: { status: "needs_review", provider: "flow", environment: "production" }, cursor: "abc" }
  )
  assert.deepEqual(
    parseListParams({ status: "", provider: "stripe", environment: ["sandbox", "x"], cursor: "x".repeat(401) }),
    { filters: { environment: "sandbox" }, cursor: undefined }
  )
  assert.deepEqual(parseListParams({ status: "approved'; drop table payments" }), { filters: {}, cursor: undefined })
})

test("listHref: filters and cursor round-trip through the query string", () => {
  assert.equal(listHref("/admin/payments", {}), "/admin/payments")
  const href = listHref("/admin/payments", { status: "approved", provider: "mercadopago" }, "eyJh+/=")
  const u = new URL(href, "https://app.example")
  assert.deepEqual(parseListParams(Object.fromEntries(u.searchParams)), {
    filters: { status: "approved", provider: "mercadopago" },
    cursor: "eyJh+/=",
  })
})

// ── access, rate limit and refund in progress ────────────────────────────────

const read = (rel: string) => readFileSync(join(process.cwd(), "modules/payments-admin", rel), "utf8")

test("permissions: payment:read opens /admin; refunding stays a separate permission", () => {
  assert.deepEqual(permissions.statement, { payment: ["read", "refund"] })
  assert.deepEqual(permissions.adminAccess, { payment: ["read"] })
  assert.equal("grants" in permissions, false) // member gets nothing
  assert.match(read("nav.ts"), /area: "admin", permission: \{ payment: \["read"\] \}/)
})

test("source: the guard is the permission, not 'is admin', and refunding still asks for payment:refund", () => {
  const access = read("server/access.ts")
  assert.doesNotMatch(access, /requireAdmin/)
  assert.match(access, /requireOnboardedUser\(/)
  assert.match(access, /if \(!\(await hasPaymentPermission\(action\)\)\) forbidden\(\)/)
  const actions = read("server/actions.ts")
  assert.match(actions, /requirePaymentPermission\("refund"\)/)
  assert.match(actions, /requirePaymentPermission\("read"\)/)
  // the permission is checked before anything is read or asked of the provider
  assert.ok(actions.indexOf('requirePaymentPermission("refund")') < actions.indexOf("getPayment(paymentId)"))
})

test("source: RefundInProgressError becomes its own error code, with text in es and en", () => {
  const actions = read("server/actions.ts")
  assert.match(actions, /e instanceof RefundInProgressError/)
  assert.match(actions, /error: "in_progress"/)
  assert.ok(es["payments-admin"].refund.errors.in_progress.length > 10)
  assert.ok(en["payments-admin"].refund.errors.in_progress.length > 10)
})

test("returnRateLimits: per IP and payment, and per IP; nothing to limit without a lookup", () => {
  assert.equal(returnRateLimits({ kind: "none" }, "1.2.3.4"), null)
  const buckets = returnRateLimits({ kind: "order", orderId: "ord-1" }, "1.2.3.4")!
  assert.deepEqual(buckets.map((b) => b.key), [
    "payments-admin:return:1.2.3.4:order:ord-1",
    "payments-admin:return:1.2.3.4",
  ])
  assert.deepEqual(buckets.map((b) => b.rule), [RETURN_TARGET_RULE, RETURN_IP_RULE])
  const other = returnRateLimits({ kind: "order", orderId: "ord-2" }, "1.2.3.4")!
  assert.notEqual(other[0].key, buckets[0].key)
  assert.equal(other[1].key, buckets[1].key)
})

test("source: the return page spends the limit before it asks the provider, and never calls out when limited", () => {
  const src = read("server/return.ts")
  assert.match(src, /from "@\/server\/rate-limit"/)
  assert.ok(src.indexOf("mayAskProvider(lookup)") > -1)
  assert.ok(src.indexOf("await mayAskProvider(lookup)") < src.indexOf("await syncPayment("))
  assert.match(src, /catch \{\s*return false\s*\}/) // a failing limiter fails closed
})
