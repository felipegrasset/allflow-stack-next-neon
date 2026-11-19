"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { useCopy } from "@/modules/i18n/ui/use-copy"

export type SectionNavLink = { href: string; label: string }

/** A link is current on its own page and on the pages below it (/admin/tickets/42). */
const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * Tabs-looking links (real navigation, so aria-current, not role="tab").
 * Used by /settings and /admin; module links arrive already filtered and
 * translated by the layout (server/module-access.ts → visibleModuleNav).
 */
export function SectionNav({ label, links }: { label: string; links: SectionNavLink[] }) {
  const pathname = usePathname()
  // The most specific match wins (/admin/payments vs /admin/payments/42).
  const current = links
    .filter((l) => isCurrent(pathname, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b">
      {links.map((l) => {
        const active = l.href === current
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** The /settings tabs: the core's two, then the `settings` links of installed modules. */
export function SettingsNav({ moduleLinks = [] }: { moduleLinks?: SectionNavLink[] }) {
  const profileCopy = useCopy("profile")
  const links = [
    { href: "/settings/profile", label: profileCopy.settings.profile },
    { href: "/settings/security", label: profileCopy.settings.security },
    ...moduleLinks,
  ]
  return <SectionNav label={profileCopy.settings.nav} links={links} />
}
