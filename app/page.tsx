import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ThemeToggle } from "@/components/theme-toggle"
import { ButtonLink } from "@/components/button-link"
import { authCopy } from "@/lib/copy/auth"
import { APP_TITLE } from "@/lib/site"
import { getAppRole, getSession, isAdminRole } from "@/server/session"

/**
 * Home. Signed out: the way in. Signed in: the onboarding gate (no
 * onboardedAt → /onboarding), then the app's dashboard — replace the body of
 * the signed-in branch with the app's real home.
 */
export default async function HomePage() {
  const session = await getSession()
  const c = authCopy.shell

  if (!session) {
    return (
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between border-b p-4">
          <span className="text-sm font-medium">{APP_TITLE}</span>
          <ThemeToggle />
        </header>
        <main id="contenido" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold">{APP_TITLE}</h1>
          <p className="text-sm text-muted-foreground">{c.guestDescription}</p>
          <div className="flex gap-2">
            <ButtonLink href="/login">
              {authCopy.login.title}
            </ButtonLink>
            <ButtonLink href="/signup" variant="outline">
              {authCopy.signup.title}
            </ButtonLink>
          </div>
        </main>
      </div>
    )
  }

  if (!session.user.onboardedAt) redirect("/onboarding")
  const role = await getAppRole(session.user.id)

  return (
    <AppShell user={session.user} isAdmin={isAdminRole(role)}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{c.welcome(session.user.name)}</h1>
        <p data-testid="session-email" className="text-sm text-muted-foreground">
          {c.signedInAs} <strong className="text-foreground">{session.user.email}</strong>
        </p>
        {role && (
          <p data-testid="session-role" className="text-sm text-muted-foreground">
            {c.role}: {role}
          </p>
        )}
      </div>
    </AppShell>
  )
}
