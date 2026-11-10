import type { Metadata } from "next"

import { LOCALES, type Locale } from "@/lib/schemas/profile"
import { slowIfFault, throwIfFault } from "@/server/e2e-faults"
import { requireOnboardedUser } from "@/server/session"
import { AvatarEditor } from "./avatar-editor"
import { ProfileForm } from "./profile-form"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const profileCopy = await getCopy("profile")
  return { title: profileCopy.profile.metaTitle }
}

export default async function ProfilePage() {
  const profileCopy = await getCopy("profile")
  const { user } = await requireOnboardedUser("/settings/profile")
  await slowIfFault()
  await throwIfFault("page-error")
  const locale = (LOCALES as readonly string[]).includes(user.locale ?? "") ? (user.locale as Locale) : "es"
  return (
    <>
      <h1 className="text-2xl font-semibold">{profileCopy.profile.title}</h1>
      <AvatarEditor name={user.name} image={user.image ?? null} />
      <ProfileForm email={user.email} initial={{ name: user.name, locale }} />
    </>
  )
}
