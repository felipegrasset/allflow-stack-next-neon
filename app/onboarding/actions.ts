"use server"

import { headers } from "next/headers"

import { sql } from "@/lib/db"
import type { FormResult } from "@/lib/schemas/auth"
import { onboardingSteps, profileSchemas, type OnboardingInput } from "@/lib/schemas/profile"
import { isLocale } from "@/modules/i18n/contracts"
import { getCopy } from "@/modules/i18n/server/copy"
import { setLocaleCookie } from "@/modules/i18n/server/cookie"
import { auth } from "@/server/auth"
import { requireUser } from "@/server/session"

/**
 * Onboarding saves each step as it goes (so leaving half-way keeps what was
 * done) and marks the user onboarded at the end — or right away with "skip".
 */

export async function saveOnboardingStepAction(
  stepIndex: number,
  input: unknown
): Promise<FormResult<keyof OnboardingInput>> {
  await requireUser("/onboarding")
  const profileCopy = await getCopy("profile")
  const { onboardingSchema } = profileSchemas(profileCopy.validation)
  const step = onboardingSteps[stepIndex]
  if (!step) return { ok: false, formError: profileCopy.common.serverError }
  if (step.fields.length === 0) return { ok: true }

  const mask = Object.fromEntries(step.fields.map((f) => [f, true])) as Partial<Record<keyof OnboardingInput, true>>
  const parsed = onboardingSchema.pick(mask).safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof OnboardingInput, string>> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof OnboardingInput] ??= issue.message
    return { ok: false, fieldErrors }
  }

  try {
    await auth.api.updateUser({ body: parsed.data, headers: await headers() })
  } catch (err) {
    console.error("[onboarding:step]", err)
    return { ok: false, formError: profileCopy.common.serverError }
  }
  // The language chosen in this step takes effect right away.
  if ("locale" in parsed.data && isLocale(parsed.data.locale)) await setLocaleCookie(parsed.data.locale)
  return { ok: true }
}

/** Finish or skip: sets "onboardedAt" (input: false in Better Auth — written here, not via updateUser). */
export async function completeOnboardingAction(): Promise<FormResult<never>> {
  const session = await requireUser("/onboarding")
  const profileCopy = await getCopy("profile")
  try {
    await sql`update "user" set "onboardedAt" = now(), "updatedAt" = now() where id = ${session.user.id} and "onboardedAt" is null`
  } catch (err) {
    console.error("[onboarding:complete]", err)
    return { ok: false, formError: profileCopy.common.serverError }
  }
  return { ok: true, redirectTo: "/" }
}
