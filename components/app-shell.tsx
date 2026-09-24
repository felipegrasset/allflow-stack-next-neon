import Link from "next/link"

import { logoutAction } from "@/app/actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { authCopy } from "@/lib/copy/auth"
import { APP_TITLE } from "@/lib/site"
import type { Session } from "@/server/auth"

/**
 * The signed-in shell: header with the main navigation, theme toggle, the
 * user's avatar and logout, and the <main id="contenido"> the skip link
 * targets. Used by app/(app)/layout.tsx and the signed-in home.
 */
export function AppShell({
  user,
  isAdmin,
  children,
}: {
  user: Session["user"]
  isAdmin: boolean
  children: React.ReactNode
}) {
  const c = authCopy.shell
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <Link href="/" className="text-sm font-semibold">
            {APP_TITLE}
          </Link>
          <nav aria-label={c.mainNav} className="flex items-center gap-1 text-sm">
            <ButtonLink href="/" variant="ghost" size="sm">
              {c.home}
            </ButtonLink>
            <ButtonLink href="/settings/profile" variant="ghost" size="sm">
              {c.settings}
            </ButtonLink>
            {isAdmin && (
              <ButtonLink href="/admin/users" variant="ghost" size="sm">
                {c.admin}
              </ButtonLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="flex items-center gap-2 text-sm">
              <UserAvatar name={user.name} image={user.image} size="sm" />
              <span className="hidden sm:inline">{user.name}</span>
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                {c.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
