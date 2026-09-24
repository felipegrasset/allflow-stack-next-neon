"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { profileCopy } from "@/lib/copy/profile"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/settings/profile", label: profileCopy.settings.profile },
  { href: "/settings/security", label: profileCopy.settings.security },
]

/** Tabs-looking links (real navigation, so aria-current, not role="tab"). */
export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label={profileCopy.settings.nav} className="flex gap-1 border-b">
      {LINKS.map((l) => {
        const active = pathname === l.href
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
