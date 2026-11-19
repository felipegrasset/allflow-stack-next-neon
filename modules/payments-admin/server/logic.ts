/**
 * Pure logic of payments-admin: no database, no network, no `@/` imports, so
 * the tests run it as is (tests/payments-admin.test.ts). Money is integers in
 * the currency's minor unit, the same as `payments`; nothing here does
 * floating-point arithmetic on amounts.
 */

/** Same shape as `PaymentStatus` of payments/contracts (kept literal so this file stays dependency-free). */
export type AdminPaymentStatus =
  | "pending"
  | "failed"
  | "approved"
  | "refunded"
  | "canceled"
  | "needs_review"

/** The fields of a `PaymentRecord` the refund rules read. */
export type RefundableRecord = {
  id: string
  status: AdminPaymentStatus
  amountMinor: number
  refundedMinor: number
}

/** Order ids as `payments` accepts them (checkoutInputSchema: trimmed, 1–200). */
export const ORDER_ID_MAX = 200

/** What is left to refund. Only an approved payment can be refunded (`refundPayment` enforces it too). */
export function refundableMinor(record: RefundableRecord): number {
  if (record.status !== "approved") return 0
  return Math.max(0, record.amountMinor - record.refundedMinor)
}

export type ParsedAmount =
  | { ok: true; minor: number }
  | { ok: false; error: "format" | "decimals" | "zero" | "too_large" }

/**
 * Parses an amount typed by a person in MAJOR units ("1990", "15,50",
 * "15.5") into an integer of minor units, with string arithmetic.
 *
 * Thousands separators are rejected on purpose: in es-CL "1.990" means one
 * thousand nine hundred ninety, in en-US it means 1.99. With money we refuse
 * to guess: digits, and at most one decimal separator ("," or ".") followed by
 * no more decimals than the currency has. For CLP (exponent 0) any separator
 * is an error, so "1.990" is rejected and the person types "1990".
 */
export function parseMajorAmount(text: string, exponent: number): ParsedAmount {
  const t = text.trim()
  const m = /^(\d{1,15})(?:[.,](\d+))?$/.exec(t)
  if (!m) return { ok: false, error: "format" }
  const [, int, frac = ""] = m
  if (frac.length > exponent) return { ok: false, error: "decimals" }
  const digits = (int + frac.padEnd(exponent, "0")).replace(/^0+(?=\d)/, "")
  const minor = Number(digits)
  if (!Number.isSafeInteger(minor)) return { ok: false, error: "too_large" }
  if (minor <= 0) return { ok: false, error: "zero" }
  return { ok: true, minor }
}

export type RefundDecision =
  | {
      ok: true
      /** What to pass to `refundPayment`: `undefined` = the provider's full refund. */
      amountArg: number | undefined
      /** What will be refunded, for the confirmation and the log. */
      refundMinor: number
    }
  | {
      ok: false
      error: "not_found" | "not_approved" | "stale" | "exceeds" | "nothing_left"
    }

/**
 * Whether a refund request may go to the provider, decided on the record the
 * SERVER just read (never on what the browser shows).
 *
 * - `paymentId` must be the payment the server found for the order: the page
 *   may be old and the order may have a newer payment.
 * - `expectedRefundedMinor` is what the person saw. If the server's figure
 *   differs, the page is stale (someone else refunded in between): refuse and
 *   make them look again.
 * - `requestedMinor` undefined = everything that is left.
 */
export function decideRefund(input: {
  record: RefundableRecord | null
  paymentId: string
  expectedRefundedMinor: number
  requestedMinor?: number
}): RefundDecision {
  const { record } = input
  if (!record || record.id !== input.paymentId)
    return { ok: false, error: "not_found" }
  if (record.status !== "approved") return { ok: false, error: "not_approved" }
  if (record.refundedMinor !== input.expectedRefundedMinor)
    return { ok: false, error: "stale" }
  const left = refundableMinor(record)
  if (left <= 0) return { ok: false, error: "nothing_left" }
  const wanted = input.requestedMinor ?? left
  if (!Number.isSafeInteger(wanted) || wanted <= 0 || wanted > left)
    return { ok: false, error: "exceeds" }
  // Full refund of an untouched payment: let the provider do "refund all"
  // (no amount). Anything else goes with its explicit amount.
  const full = wanted === record.amountMinor && record.refundedMinor === 0
  return { ok: true, amountArg: full ? undefined : wanted, refundMinor: wanted }
}

// ── Return page (/pago/retorno) ──────────────────────────────────────────────

/** Internal path: one leading `/`, no scheme, no `//`, no `\`, no spaces (no open redirects). Same rule as payments' INTERNAL_PATH. */
const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/

export function safeInternalPath(
  value: string | undefined,
  fallback = "/"
): string {
  if (!value || value.length > 500 || !INTERNAL_PATH.test(value))
    return fallback
  return value
}

/** A provider reference coming from the browser: only used to ASK the provider, never trusted. */
const PROVIDER_REF = /^[A-Za-z0-9_.:-]{1,200}$/
/** Payment ids of `payments` are `crypto.randomUUID()`. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v

export type ReturnLookup =
  | { kind: "order"; orderId: string; providerRef?: string }
  | { kind: "payment"; paymentId: string; providerRef?: string }
  | { kind: "none" }

/**
 * Which payment the return page reconciles, from its query string:
 *
 * - `order` — what `paymentReturnPath()` (contracts/) puts in the return URL;
 *   works with every provider, also Flow, which returns by POST with the
 *   token in the body (the page cannot read it: `syncPayment` falls back to
 *   the stored reference).
 * - `external_reference` — Mercado Pago adds it (it is the payment id of the
 *   app); accepted only with the shape of a payment id.
 *
 * `payment_id` (Mercado Pago), `token` (Flow by GET) or `_ptxn` (Paddle) go
 * along as the provider reference; `syncPayment` checks that the provider's
 * answer belongs to THIS payment and rejects it otherwise.
 */
export function resolveReturnLookup(params: SearchParams): ReturnLookup {
  const rawRef =
    first(params.payment_id) ?? first(params.token) ?? first(params._ptxn)
  const providerRef =
    rawRef && PROVIDER_REF.test(rawRef) && rawRef !== "null" ? rawRef : undefined
  const order = first(params.order)?.trim()
  if (order && order.length <= ORDER_ID_MAX)
    return { kind: "order", orderId: order, providerRef }
  const ext = first(params.external_reference)?.trim()
  if (ext && UUID.test(ext))
    return { kind: "payment", paymentId: ext, providerRef }
  return { kind: "none" }
}

/** Rate-limit rule shape (same as `consume` of `@/server/rate-limit`, kept literal: no imports here). */
export type ReturnRateRule = { max: number; windowMs: number }

/** Per visitor (IP) and payment: a refresh or two is normal, a script is not. */
export const RETURN_TARGET_RULE: ReturnRateRule = { max: 10, windowMs: 60_000 }
/** Per visitor (IP) across all payments: stops walking through order ids. */
export const RETURN_IP_RULE: ReturnRateRule = { max: 30, windowMs: 60_000 }

/**
 * The limiter buckets one visit to the return page counts against, BEFORE the
 * provider is asked: the IP and the order (or payment id), and the IP alone.
 * `null` for a lookup that never reaches the provider.
 */
export function returnRateLimits(
  lookup: ReturnLookup,
  ip: string
): { key: string; rule: ReturnRateRule }[] | null {
  if (lookup.kind === "none") return null
  const target = lookup.kind === "order" ? `order:${lookup.orderId}` : `payment:${lookup.paymentId}`
  return [
    { key: `payments-admin:return:${ip}:${target}`, rule: RETURN_TARGET_RULE },
    { key: `payments-admin:return:${ip}`, rule: RETURN_IP_RULE },
  ]
}

export type ReturnOutcome =
  | "approved"
  | "pending"
  | "failed"
  | "review"
  | "refunded"
  | "canceled"
  | "unknown"

/**
 * What the person who just paid is told. `needs_review` becomes "review"
 * (we are checking your payment) without details: the reason (amount
 * mismatch, a second payment…) is for the admin, not the public page.
 */
export function returnOutcome(
  status: AdminPaymentStatus | null | undefined
): ReturnOutcome {
  switch (status) {
    case "approved":
      return "approved"
    case "pending":
      return "pending"
    case "failed":
      return "failed"
    case "needs_review":
      return "review"
    case "refunded":
      return "refunded"
    case "canceled":
      return "canceled"
    default:
      return "unknown"
  }
}

/** Badge look of each status (variants of components/ui/badge). */
export function statusVariant(
  status: AdminPaymentStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default"
    case "needs_review":
    case "failed":
      return "destructive"
    case "pending":
      return "secondary"
    default:
      return "outline"
  }
}

// ── List filters (/admin/payments) ───────────────────────────────────────────

/** Kept literal so this file stays dependency-free; tests check them against payments' lists. */
export const FILTER_STATUSES = [
  "pending",
  "failed",
  "approved",
  "refunded",
  "canceled",
  "needs_review",
] as const satisfies readonly AdminPaymentStatus[]
export const FILTER_PROVIDERS = ["mercadopago", "flow", "paddle"] as const
export const FILTER_ENVIRONMENTS = ["sandbox", "production"] as const

export type ListFilters = {
  status?: (typeof FILTER_STATUSES)[number]
  provider?: (typeof FILTER_PROVIDERS)[number]
  environment?: (typeof FILTER_ENVIRONMENTS)[number]
}

const pick = <T extends string>(
  allowed: readonly T[],
  v: string | string[] | undefined
): T | undefined => {
  const s = first(v)
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : undefined
}

/**
 * Filters and cursor from the query string. Unknown values are dropped (an
 * empty <select> sends `status=`), never passed on. The cursor is only
 * bounded here: `listPayments` decides whether it is valid.
 */
export function parseListParams(params: SearchParams): {
  filters: ListFilters
  cursor?: string
} {
  const filters: ListFilters = {}
  const status = pick(FILTER_STATUSES, params.status)
  const provider = pick(FILTER_PROVIDERS, params.provider)
  const environment = pick(FILTER_ENVIRONMENTS, params.environment)
  if (status) filters.status = status
  if (provider) filters.provider = provider
  if (environment) filters.environment = environment
  const c = first(params.cursor)
  return { filters, cursor: c && c.length <= 400 ? c : undefined }
}

/** `/admin/payments?…` with the filters (and a cursor, for "next page"). */
export function listHref(
  base: string,
  filters: ListFilters,
  cursor?: string
): string {
  const q = new URLSearchParams()
  if (filters.status) q.set("status", filters.status)
  if (filters.provider) q.set("provider", filters.provider)
  if (filters.environment) q.set("environment", filters.environment)
  if (cursor) q.set("cursor", cursor)
  const s = q.toString()
  return s ? `${base}?${s}` : base
}
