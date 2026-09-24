import { z } from "zod"

import { profileCopy } from "@/lib/copy/profile"

/**
 * Shared by the profile kit's forms (client) and its Server Actions (server).
 * Messages come from lib/copy/profile.ts.
 */
const v = profileCopy.validation

export const LOCALES = ["es", "en"] as const
export type Locale = (typeof LOCALES)[number]

const name = z.string().trim().min(1, v.nameRequired).max(100, v.nameMax)
const locale = z.enum(LOCALES, { error: v.localeInvalid })

export const profileSchema = z.object({ name, locale })
export type ProfileInput = z.infer<typeof profileSchema>

/** Onboarding: the same fields as the profile, saved one step at a time. */
export const onboardingSchema = profileSchema
export type OnboardingInput = ProfileInput
export const onboardingSteps = [
  { id: "profile", fields: ["name"] },
  { id: "preferences", fields: ["locale"] },
  { id: "done", fields: [] },
] as const satisfies ReadonlyArray<{ id: string; fields: ReadonlyArray<keyof OnboardingInput> }>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, v.currentPasswordRequired),
    newPassword: z.string().min(8, v.newPasswordMin).max(128, v.newPasswordMax),
    confirm: z.string().min(1, v.confirmRequired),
    revokeOtherSessions: z.boolean(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: v.passwordsDontMatch })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: v.newPasswordSame })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

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
