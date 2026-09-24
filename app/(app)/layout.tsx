import { AppShell } from "@/components/app-shell"
import { getAppRole, isAdminRole, requireOnboardedUser } from "@/server/session"

/**
 * Everything signed-in lives under this group: /settings/*, /admin/*.
 * Signed out → /login (proxy.ts adds ?next=); not onboarded → /onboarding.
 * Each page and Server Action checks again: layouts don't re-run on every
 * client navigation, and actions are reachable by direct POST.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedUser()
  const role = await getAppRole(session.user.id)
  return (
    <AppShell user={session.user} isAdmin={isAdminRole(role)}>
      {children}
    </AppShell>
  )
}
