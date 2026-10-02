import { redirect } from "next/navigation"

import { AppHome } from "@/app/(app)/home"
import { Landing } from "@/app/(marketing)/landing"
import { AppShell } from "@/components/app-shell"
import { getAppRole, getSession, isAdminRole } from "@/server/session"

/**
 * Home. Signed out: the landing (app/(marketing)/landing.tsx). Signed in: the
 * onboarding gate (no onboardedAt → /onboarding), then the app's home
 * (app/(app)/home.tsx) inside the shell. Edit those two files, not this one.
 */
export default async function HomePage() {
  const session = await getSession()
  if (!session) return <Landing />

  if (!session.user.onboardedAt) redirect("/onboarding")
  const role = await getAppRole(session.user.id)

  return (
    <AppShell user={session.user} isAdmin={isAdminRole(role)}>
      <AppHome name={session.user.name} email={session.user.email} role={role ?? null} />
    </AppShell>
  )
}
