import { authCopy } from "@/lib/copy/auth"

export type NavItem = { href: string; label: string; adminOnly?: boolean }

/**
 * The signed-in navigation (read by components/app-shell.tsx). The genesis
 * rewrites this file to list the domain's entities; keep Inicio first.
 */
export const navItems: NavItem[] = [
  { href: "/", label: authCopy.shell.home },
  { href: "/settings/profile", label: authCopy.shell.settings },
  { href: "/admin/users", label: authCopy.shell.admin, adminOnly: true },
]
