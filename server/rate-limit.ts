import { headers } from "next/headers"

/**
 * A small sliding-window limiter for the auth Server Actions.
 *
 * Why it exists: Better Auth rate-limits its HTTP routes (/api/auth/*), but the
 * forms here call `auth.api.*` from Server Actions, which skips its router — and
 * with it the limiter. Without this, /login would accept unlimited password
 * guesses.
 *
 * It is in-memory and per process: enough for one server and for the e2e, NOT
 * a distributed limiter. On serverless each instance counts on its own, so a
 * determined attacker gets N× the budget. When the app needs more, back it
 * with the database or Redis (same `consume()` signature).
 */

type Rule = { max: number; windowMs: number }

export const RULES = {
  login: { max: 5, windowMs: 60_000 },
  signup: { max: 20, windowMs: 60_000 },
  magicLink: { max: 3, windowMs: 60_000 },
  forgot: { max: 3, windowMs: 60_000 },
  /** The 60 s resend cooldown of /verify-email, enforced server-side too. */
  resendVerification: { max: 1, windowMs: 60_000 },
  changePassword: { max: 5, windowMs: 60_000 },
} satisfies Record<string, Rule>

const g = globalThis as unknown as { __allflowRateLimit?: Map<string, number[]> }
const hits: Map<string, number[]> = (g.__allflowRateLimit ??= new Map())

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export function consume(key: string, rule: Rule, now = Date.now()): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs)
  if (recent.length >= rule.max) {
    hits.set(key, recent)
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000)) }
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 10_000) {
    for (const [k, ts] of hits) if (!ts.some((t) => now - t < 3_600_000)) hits.delete(k)
  }
  return { ok: true }
}

/** The client IP as the proxy in front reports it (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local"
}

/** `limit("login", email)` → keyed by rule + IP + subject (lower-cased). */
export async function limit(rule: keyof typeof RULES, subject: string): Promise<RateLimitResult> {
  return consume(`${rule}:${await clientIp()}:${subject.toLowerCase()}`, RULES[rule])
}
