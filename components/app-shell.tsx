import Link from "next/link"

import { logoutAction } from "@/app/actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { BrandMark } from "@/components/brand-mark"
import { navItems } from "@/config/nav"
import { moduleHeaderSlots, moduleNavItems } from "@/config/nav.modules"
import { getTranslations } from "next-intl/server"

import { labelKey } from "@/modules/i18n/ui/labels"
import { getCopy } from "@/modules/i18n/server/copy"
import type { Session } from "@/server/auth"

/**
 * The signed-in shell: header with the main navigation, theme toggle, the
 * user's avatar and logout, and the <main id="contenido"> the skip link
 * targets. Used by app/(app)/layout.tsx and the signed-in home.
 */
export async function AppShell({
  user,
  isAdmin,
  children,
}: {
  user: Session["user"]
  isAdmin: boolean
  children: React.ReactNode
}) {
  const authCopy = await getCopy("auth")
  const c = authCopy.shell
  const t = await getTranslations()
  const navLabel = (label: string) => {
    const key = labelKey(label, (k) => t.has(k))
    return key ? t(key) : label
  }
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <Link href="/" className="text-sm font-semibold">
            <BrandMark />
          </Link>
          <nav aria-label={c.mainNav} className="flex items-center gap-1 text-sm">
            {[...navItems, ...moduleNavItems]
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <ButtonLink key={item.href} href={item.href} variant="ghost" size="sm">
                  {navLabel(item.label)}
                </ButtonLink>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* Header slots of installed modules (config/nav.modules.ts). */}
            {moduleHeaderSlots.map(({ id, Slot }) => (
              <Slot key={id} user={user} />
            ))}
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
