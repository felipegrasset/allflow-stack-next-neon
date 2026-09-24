import type { Metadata } from "next"
import { headers } from "next/headers"

import { profileCopy } from "@/lib/copy/profile"
import { auth } from "@/server/auth"
import { requireOnboardedUser } from "@/server/session"
import { ChangePasswordForm } from "./change-password-form"
import { SessionsCard } from "./sessions-card"

export const metadata: Metadata = { title: profileCopy.security.metaTitle }

export default async function SecurityPage() {
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
