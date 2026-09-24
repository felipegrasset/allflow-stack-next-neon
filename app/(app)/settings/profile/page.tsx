import type { Metadata } from "next"

import { profileCopy } from "@/lib/copy/profile"
import { LOCALES, type Locale } from "@/lib/schemas/profile"
import { requireOnboardedUser } from "@/server/session"
import { AvatarEditor } from "./avatar-editor"
import { ProfileForm } from "./profile-form"

export const metadata: Metadata = { title: profileCopy.profile.metaTitle }

export default async function ProfilePage() {
  const { user } = await requireOnboardedUser("/settings/profile")
  const locale = (LOCALES as readonly string[]).includes(user.locale ?? "") ? (user.locale as Locale) : "es"
  return (
    <>
      <h1 className="text-2xl font-semibold">{profileCopy.profile.title}</h1>
      <AvatarEditor name={user.name} image={user.image ?? null} />
      <ProfileForm email={user.email} initial={{ name: user.name, locale }} />
    </>
  )
}
