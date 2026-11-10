"use server"

import { headers } from "next/headers"
import { APIError } from "better-auth/api"

import type { FormResult } from "@/lib/schemas/auth"
import {
  avatarSchema,
  profileSchemas,
  type ChangePasswordInput,
  type ProfileInput,
} from "@/lib/schemas/profile"
import { isLocale } from "@/modules/i18n/contracts"
import { getCopy } from "@/modules/i18n/server/copy"
import { setLocaleCookie } from "@/modules/i18n/server/cookie"
import { auth } from "@/server/auth"
import { limit } from "@/server/rate-limit"
import { requireOnboardedUser } from "@/server/session"

function codeOf(err: unknown): string | undefined {
  if (err instanceof APIError) return (err.body as { code?: string } | undefined)?.code
  return undefined
}

export async function updateProfileAction(input: unknown): Promise<FormResult<keyof ProfileInput>> {
  await requireOnboardedUser("/settings/profile")
  const c = await getCopy("profile")
  const { profileSchema } = profileSchemas(c.validation)
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ProfileInput, string>> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof ProfileInput] ??= issue.message
    return { ok: false, fieldErrors }
  }
  try {
    await auth.api.updateUser({ body: parsed.data, headers: await headers() })
  } catch (err) {
    console.error("[profile:update]", err)
    return { ok: false, formError: c.common.serverError }
  }
  // The profile's language becomes the active one (the selector's cookie).
  if (isLocale(parsed.data.locale)) await setLocaleCookie(parsed.data.locale)
  return { ok: true }
}

/**
 * The avatar is a data URL (≤256 px, cropped in the browser) stored in
 * "user".image — the floor has no storage overlay. `null` removes it.
 */
export async function updateAvatarAction(input: unknown): Promise<FormResult<"image">> {
  await requireOnboardedUser("/settings/profile")
  const c = await getCopy("profile")
  const parsed = avatarSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.avatar.invalidType }
  try {
    await auth.api.updateUser({ body: { image: parsed.data.image }, headers: await headers() })
  } catch (err) {
    console.error("[profile:avatar]", err)
    return { ok: false, formError: c.avatar.failed }
  }
  return { ok: true }
}

export async function changePasswordAction(input: unknown): Promise<FormResult<keyof ChangePasswordInput>> {
  const session = await requireOnboardedUser("/settings/security")
  const c = await getCopy("profile")
  const { changePasswordSchema } = profileSchemas(c.validation)
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: c.common.serverError }

  const rl = await limit("changePassword", session.user.id)
  if (!rl.ok) return { ok: false, formError: `${c.common.serverError} (${rl.retryAfter} s)` }

  const { currentPassword, newPassword, revokeOtherSessions } = parsed.data
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions },
      headers: await headers(),
    })
  } catch (err) {
    const code = codeOf(err)
    if (code === "INVALID_PASSWORD") return { ok: false, fieldErrors: { currentPassword: c.security.wrongPassword } }
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return { ok: false, formError: c.security.noPassword }
    console.error("[security:changePassword]", err)
    return { ok: false, formError: c.common.serverError }
  }
  return { ok: true, message: revokeOtherSessions ? c.security.changedRevoked : c.security.changed }
}

export async function revokeOtherSessionsAction(): Promise<FormResult<never>> {
  await requireOnboardedUser("/settings/security")
  const c = await getCopy("profile")
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() })
  } catch (err) {
    console.error("[security:revokeOthers]", err)
    return { ok: false, formError: c.security.revokeFailed }
  }
  return { ok: true }
}
