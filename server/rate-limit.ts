import { headers } from "next/headers"
import { sql } from "kysely"

import { getKysely } from "@/server/db/pool"

/**
 * A sliding-window limiter for the auth Server Actions, backed by Postgres.
 *
 * Why it exists: Better Auth rate-limits its HTTP routes (/api/auth/*), but the
 * forms here call `auth.api.*` from Server Actions, which skips its router — and
 * with it the limiter. Without this, /login would accept unlimited password
 * guesses.
 *
 * Why Postgres: on serverless each instance has its own memory, so an
 * in-process counter gave an attacker N× the budget. The hits live in
 * `rate_limit_hit` (migration 0002), one row per accepted attempt, and every
 * instance counts the same rows.
 *
 * One transaction per call, over the pool (the Neon HTTP driver has no
 * transactions — CONVENTIONS.md §6): an advisory lock on the key serialises
 * concurrent attempts on the SAME key, so two requests can't both read "4 of
 * 5" and both get in. Different keys never wait on each other. Old rows are
 * purged in the same transaction, so the table holds at most the last
 * `MAX_WINDOW_MS` of attempts.
 *
 * If the database is down this throws — and so would the login it guards.
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

/** Rows older than this are no longer inside any window — the purge's horizon. */
const MAX_WINDOW_MS = Math.max(3_600_000, ...Object.values(RULES).map((r) => r.windowMs))

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export async function consume(key: string, rule: Rule, now = Date.now()): Promise<RateLimitResult> {
  return getKysely()
    .transaction()
    .execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(trx)
      await sql`delete from rate_limit_hit where at < ${new Date(now - MAX_WINDOW_MS)}`.execute(trx)

      const { rows } = await sql<{ n: number; oldest: Date | null }>`
        select count(*)::int as n, min(at) as oldest
        from rate_limit_hit
        where key = ${key} and at > ${new Date(now - rule.windowMs)}
      `.execute(trx)
      const { n, oldest } = rows[0] ?? { n: 0, oldest: null }

      if (n >= rule.max) {
        const first = oldest ? new Date(oldest).getTime() : now
        return { ok: false, retryAfter: Math.max(1, Math.ceil((first + rule.windowMs - now) / 1000)) }
      }
      await sql`insert into rate_limit_hit (key, at) values (${key}, ${new Date(now)})`.execute(trx)
      return { ok: true }
    })
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
