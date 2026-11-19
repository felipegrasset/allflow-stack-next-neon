import { forbidden, redirect } from "next/navigation"

import { requireAdminArea, visibleModuleNav } from "@/server/module-access"

/**
 * /admin has no page of its own: it sends each person to the first entry they
 * may open — /admin/users for owner/admin, else the first `admin`-area link of
 * an installed module this person can see. Nothing visible → 403.
 */
export default async function AdminIndexPage() {
  const { isAdmin } = await requireAdminArea("/admin")
  if (isAdmin) redirect("/admin/users")
  const [first] = await visibleModuleNav("admin")
  if (!first) forbidden()
  redirect(first.href)
}
