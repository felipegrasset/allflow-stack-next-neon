"use server"

import { headers } from "next/headers"
import { APIError } from "better-auth/api"

import { auth } from "@/server/auth"
import {
  loginSchema,
  signUpSchema,
  type FormResult,
  type LoginInput,
  type SignUpInput,
} from "@/lib/schemas/auth"

function codeOf(err: unknown): string | undefined {
  if (err instanceof APIError) {
    const body = err.body as { code?: string } | undefined
    return body?.code
  }
  return undefined
}

export async function signUpAction(input: unknown): Promise<FormResult<keyof SignUpInput>> {
  // Always re-validate on the server: Server Actions are reachable by direct POST.
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: "Revisa los datos del formulario." }

  try {
    await auth.api.signUpEmail({
      body: { ...parsed.data, callbackURL: "/" },
      headers: await headers(),
    })
  } catch (err) {
    const code = codeOf(err)
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return { ok: false, fieldErrors: { email: "Ese correo ya está registrado." } }
    }
    if (err instanceof APIError && err.status === "TOO_MANY_REQUESTS") {
      return { ok: false, formError: "Demasiados intentos. Espera un momento y vuelve a probar." }
    }
    console.error("[signUp]", err)
    return { ok: false, formError: "No pudimos crear la cuenta. Inténtalo de nuevo." }
  }
  return { ok: true, redirectTo: `/check-email?email=${encodeURIComponent(parsed.data.email)}` }
}

export async function loginAction(input: unknown): Promise<FormResult<keyof LoginInput>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: "Revisa los datos del formulario." }

  try {
    await auth.api.signInEmail({
      body: { ...parsed.data, callbackURL: "/" },
      headers: await headers(),
    })
  } catch (err) {
    const code = codeOf(err)
    if (code === "EMAIL_NOT_VERIFIED") {
      return {
        ok: false,
        formError: "Todavía no confirmas tu correo. Te enviamos un enlace nuevo.",
      }
    }
    if (code === "INVALID_EMAIL_OR_PASSWORD") {
      return { ok: false, formError: "Correo o contraseña incorrectos." }
    }
    if (err instanceof APIError && err.status === "TOO_MANY_REQUESTS") {
      return { ok: false, formError: "Demasiados intentos. Espera un momento y vuelve a probar." }
    }
    console.error("[login]", err)
    return { ok: false, formError: "No pudimos iniciar sesión. Inténtalo de nuevo." }
  }
  return { ok: true, redirectTo: "/" }
}
