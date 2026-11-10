import type { Metadata } from "next"
import { headers } from "next/headers"

import { auth } from "@/server/auth"
import { requireOnboardedUser } from "@/server/session"
import { ChangePasswordForm } from "./change-password-form"
import { SessionsCard } from "./sessions-card"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const profileCopy = await getCopy("profile")
  return { title: profileCopy.security.metaTitle }
}

export default async function SecurityPage() {
  const profileCopy = await getCopy("profile")
  await requireOnboardedUser("/settings/security")
  const sessions = await auth.api.listSessions({ headers: await headers() })
  return (
    <>
      <h1 className="text-2xl font-semibold">{profileCopy.settings.security}</h1>
      <ChangePasswordForm />
      <SessionsCard count={sessions.length} />
    </>
  )
}
