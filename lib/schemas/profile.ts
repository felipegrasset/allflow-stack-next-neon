import { z } from "zod"

import type { ProfileCopy } from "@/lib/copy/profile"
import { LOCALES } from "@/modules/i18n/contracts"

export { LOCALES, type Locale } from "@/modules/i18n/contracts"

/**
 * Shared by the profile kit's forms (client) and its Server Actions (server).
 * The messages depend on the language, so the schemas are built from the
 * `validation` group of the profile copy (see lib/schemas/auth.ts for the
 * pattern). `LOCALES` is the i18n module's.
 */
export function profileSchemas(v: ProfileCopy["validation"]) {
  const name = z.string().trim().min(1, v.nameRequired).max(100, v.nameMax)
  const locale = z.enum(LOCALES, { error: v.localeInvalid })

  const profileSchema = z.object({ name, locale })
  /** Onboarding: the same fields as the profile, saved one step at a time. */
  const onboardingSchema = profileSchema

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, v.currentPasswordRequired),
      newPassword: z.string().min(8, v.newPasswordMin).max(128, v.newPasswordMax),
      confirm: z.string().min(1, v.confirmRequired),
      revokeOtherSessions: z.boolean(),
    })
    .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: v.passwordsDontMatch })
    .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: v.newPasswordSame })

  return { profileSchema, onboardingSchema, changePasswordSchema }
}
type ProfileSchemas = ReturnType<typeof profileSchemas>
export type ProfileInput = z.infer<ProfileSchemas["profileSchema"]>
export type OnboardingInput = ProfileInput
export type ChangePasswordInput = z.infer<ProfileSchemas["changePasswordSchema"]>

export const onboardingSteps = [
  { id: "profile", fields: ["name"] },
  { id: "preferences", fields: ["locale"] },
  { id: "done", fields: [] },
] as const satisfies ReadonlyArray<{ id: string; fields: ReadonlyArray<keyof OnboardingInput> }>

/**
 * The avatar: no storage overlay in the floor, so it lives in "user".image as
 * a data URL, already cropped square and resized to 256 px by the browser
 * (see CONVENTIONS.md §"Avatar"). The server re-checks format and size.
 */
export const AVATAR_SIZE = 256
export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const AVATAR_ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
/** ~256×256 WebP/JPEG at q≈0.85 is 10–40 KB; 200 KB of base64 is a generous ceiling. */
export const AVATAR_MAX_DATA_URL_LENGTH = 200_000

export const avatarSchema = z.object({
  image: z
    .string()
    .max(AVATAR_MAX_DATA_URL_LENGTH)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/)
    .nullable(),
})
export type AvatarInput = z.infer<typeof avatarSchema>

export const ASSIGNABLE_ROLES = ["admin", "member"] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const updateRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ASSIGNABLE_ROLES),
})
export const removeMemberSchema = z.object({ memberId: z.string().min(1) })
