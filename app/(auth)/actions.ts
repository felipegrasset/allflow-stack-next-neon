"use server"

import { headers } from "next/headers"
import { APIError } from "better-auth/api"

import { authCopy } from "@/lib/copy/auth"
import { sql } from "@/lib/db"
import {
  emailOnlySchema,
  loginSchema,
  resetPasswordSchema,
  safeNext,
  signUpSchema,
  type EmailOnlyInput,
  type FormResult,
  type LoginInput,
  type ResetPasswordInput,
  type SignUpInput,
} from "@/lib/schemas/auth"
import { auth } from "@/server/auth"
import { limit } from "@/server/rate-limit"
import { emailVerificationRequired } from "@/server/email/send"

/**
 * The auth kit's Server Actions. Every one re-validates with the same Zod
 * schema as its form (Server Actions are reachable by direct POST) and goes
 * through server/rate-limit.ts: `auth.api.*` called from the server skips
 * Better Auth's own HTTP rate limiter.
 */

const c = authCopy

function codeOf(err: unknown): string | undefined {
  if (err instanceof APIError) return (err.body as { code?: string } | undefined)?.code
  return undefined
}

const tooMany = (err: unknown) => err instanceof APIError && err.status === "TOO_MANY_REQUESTS"

export async function signUpAction(input: unknown): Promise<FormResult<keyof SignUpInput>> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  const rl = await limit("signup", "")
  if (!rl.ok) return { ok: false, formError: c.errors.rateLimited(rl.retryAfter) }

  // "That email is already registered", on the field. With email verification
  // on, Better Auth answers a duplicate sign-up with a generic success (no
  // account enumeration); the floor's UX (investigation E, screen 2) asks for
  // the explicit error, so it is checked here. It does reveal that an account
  // exists — accepted for sign-up, rate-limited above; "forgot password" stays
  // generic. To go back to Better Auth's behaviour, delete this block.
  const [existing] = await sql<{ id: string }>`select id from "user" where lower(email) = lower(${parsed.data.email}) limit 1`
  if (existing) return { ok: false, fieldErrors: { email: c.signup.emailTaken } }

  try {
    await auth.api.signUpEmail({
      body: { ...parsed.data, callbackURL: "/" },
      headers: await headers(),
    })
  } catch (err) {
    if (codeOf(err)?.startsWith("USER_ALREADY_EXISTS")) {
      return { ok: false, fieldErrors: { email: c.signup.emailTaken } }
    }
    if (tooMany(err)) return { ok: false, formError: c.errors.rateLimited(60) }
    console.error("[signUp]", err)
    return { ok: false, formError: c.signup.failed }
  }
  // Without email verification (a deployed app with no email provider, see
  // server/email/send.ts) Better Auth already signed the user in: straight
  // to the app, where the onboarding gate takes over.
  if (!emailVerificationRequired()) return { ok: true, redirectTo: "/" }
  return { ok: true, redirectTo: `/verify-email?email=${encodeURIComponent(parsed.data.email)}` }
}

export async function loginAction(input: unknown, next?: string): Promise<FormResult<keyof LoginInput>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  const rl = await limit("login", parsed.data.email)
  if (!rl.ok) return { ok: false, formError: c.errors.rateLimited(rl.retryAfter) }

  try {
    await auth.api.signInEmail({
      body: { ...parsed.data, callbackURL: "/" },
      headers: await headers(),
    })
  } catch (err) {
    const code = codeOf(err)
    if (code === "EMAIL_NOT_VERIFIED") return { ok: false, formError: c.login.emailNotVerified }
    if (code === "INVALID_EMAIL_OR_PASSWORD") return { ok: false, formError: c.login.invalidCredentials }
    if (tooMany(err)) return { ok: false, formError: c.errors.rateLimited(60) }
    console.error("[login]", err)
    return { ok: false, formError: c.login.failed }
  }
  return { ok: true, redirectTo: safeNext(next) }
}

/** Magic link. Always the same answer, whether or not the account exists. */
export async function magicLinkAction(input: unknown, next?: string): Promise<FormResult<keyof EmailOnlyInput>> {
  const parsed = emailOnlySchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  const rl = await limit("magicLink", parsed.data.email)
  if (!rl.ok) return { ok: false, formError: c.errors.rateLimited(rl.retryAfter) }

  try {
    await auth.api.signInMagicLink({
      body: { email: parsed.data.email, callbackURL: safeNext(next) },
      headers: await headers(),
    })
  } catch (err) {
    console.error("[magicLink]", err)
    return { ok: false, formError: c.magicLink.failed }
  }
  return { ok: true, message: c.magicLink.sent(parsed.data.email) }
}

/**
 * Forgot password. The answer is generic ON PURPOSE — identical whether the
 * email has an account or not (Better Auth also equalizes the timing). Only
 * the rate limit can say no, and it says the same for every email.
 */
export async function forgotPasswordAction(input: unknown): Promise<FormResult<keyof EmailOnlyInput>> {
  const parsed = emailOnlySchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  const rl = await limit("forgot", parsed.data.email)
  if (!rl.ok) return { ok: false, formError: c.errors.rateLimited(rl.retryAfter) }

  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    })
  } catch (err) {
    // Logged, never surfaced: a different message would leak information.
    console.error("[forgotPassword]", err)
  }
  return { ok: true, message: c.forgot.sent }
}

export async function resetPasswordAction(input: unknown): Promise<FormResult<keyof ResetPasswordInput>> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: await headers(),
    })
  } catch (err) {
    const code = codeOf(err)
    if (code === "INVALID_TOKEN") return { ok: false, formError: c.reset.invalidTitle }
    if (code === "PASSWORD_TOO_SHORT") return { ok: false, fieldErrors: { password: c.validation.passwordMin } }
    console.error("[resetPassword]", err)
    return { ok: false, formError: c.reset.failed }
  }
  return { ok: true, redirectTo: "/login?reset=ok" }
}

/**
 * "Resend the verification email". 60 s cooldown per email, enforced here as
 * well as in the UI. Generic answer: it never says whether the email exists.
 */
export async function resendVerificationAction(
  input: unknown
): Promise<FormResult<keyof EmailOnlyInput> & { retryAfter?: number }> {
  const parsed = emailOnlySchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.errors.invalidForm }

  const rl = await limit("resendVerification", parsed.data.email)
  if (!rl.ok) return { ok: false, formError: c.verifyEmail.cooldown(rl.retryAfter), retryAfter: rl.retryAfter }

  try {
    await auth.api.sendVerificationEmail({
      body: { email: parsed.data.email, callbackURL: "/" },
      headers: await headers(),
    })
  } catch (err) {
    console.error("[resendVerification]", err)
    return { ok: false, formError: c.verifyEmail.resendFailed }
  }
  return { ok: true }
}
