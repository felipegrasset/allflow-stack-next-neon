import { authCopy } from "@/lib/copy/auth"

/**
 * The signed-in home, rendered inside the AppShell by app/page.tsx (after the
 * session and onboarding checks). Outside the read-only zones: the genesis
 * replaces this file with the domain's dashboard.
 */
export function AppHome({ name, email, role }: { name: string; email: string; role: string | null }) {
  const c = authCopy.shell
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{c.welcome(name)}</h1>
      <p data-testid="session-email" className="text-sm text-muted-foreground">
        {c.signedInAs} <strong className="text-foreground">{email}</strong>
      </p>
      {role && (
        <p data-testid="session-role" className="text-sm text-muted-foreground">
          {c.role}: {role}
        </p>
      )}
    </div>
  )
}
