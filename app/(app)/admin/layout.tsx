import { SectionNav } from "@/components/settings-nav"
import { getCopy } from "@/modules/i18n/server/copy"
import { requireAdminArea, visibleModuleNav } from "@/server/module-access"

/**
 * /admin/* — owner/admin, or anyone holding at least one `adminAccess`
 * permission declared by an installed module (ticket:manage, audit:read…);
 * anyone else gets the 403 page. This is only the door: every page and
 * Server Action checks ITS permission (/admin/users keeps `requireAdmin()`).
 * The menu lists only the entries this person may open.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await requireAdminArea()
  const [authCopy, moduleLinks] = await Promise.all([getCopy("auth"), visibleModuleNav("admin")])
  if (!moduleLinks.length) return children
  const links = [
    ...(isAdmin ? [{ href: "/admin/users", label: authCopy.shell.admin }] : []),
    ...moduleLinks,
  ]
  return (
    <div className="flex flex-col gap-6">
      <SectionNav label={authCopy.shell.adminArea} links={links} />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
