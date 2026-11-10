import { z } from "zod"

import type { AuthCopy } from "@/lib/copy/auth"

/**
 * Shared by the client forms (RHF + zodResolver) and the Server Actions
 * (safeParse again: Server Actions are reachable by direct POST). The messages
 * depend on the language, so the schemas are built from the `validation` group
 * of the auth copy:
 *
 *   server: const { loginSchema } = authSchemas((await getCopy("auth")).validation)
 *   client: const { loginSchema } = useMemo(() => authSchemas(copy.validation), [copy])
 */
export function authSchemas(v: AuthCopy["validation"]) {
  const email = z.string().trim().min(1, v.emailRequired).email(v.emailInvalid)
  const newPassword = z.string().min(8, v.passwordMin).max(128, v.passwordMax)

  const signUpSchema = z.object({
    name: z.string().trim().min(1, v.nameRequired).max(100, v.nameMax),
    email,
    password: newPassword,
  })

  const loginSchema = z.object({
    email,
    password: z.string().min(1, v.passwordRequired),
  })

  /** Magic link, forgot password and "resend verification" all take just an email. */
  const emailOnlySchema = z.object({ email })

  const resetPasswordSchema = z
    .object({
      token: z.string().min(1),
      password: newPassword,
      confirm: z.string().min(1, v.confirmRequired),
    })
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: v.passwordsDontMatch })

  return { signUpSchema, loginSchema, emailOnlySchema, resetPasswordSchema }
}
type AuthSchemas = ReturnType<typeof authSchemas>
export type SignUpInput = z.infer<AuthSchemas["signUpSchema"]>
export type LoginInput = z.infer<AuthSchemas["loginSchema"]>
export type EmailOnlyInput = z.infer<AuthSchemas["emailOnlySchema"]>
export type ResetPasswordInput = z.infer<AuthSchemas["resetPasswordSchema"]>

/**
 * What every form Server Action returns. `fieldErrors` are mounted with
 * setError(field, …, { shouldFocus: true }); `formError` goes to the
 * role="alert" banner of the form.
 */
export type FormResult<K extends string> =
  | { ok: true; redirectTo?: string; message?: string }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<K, string>> }

/** Only same-origin relative paths: `next=` must never become an open redirect. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
