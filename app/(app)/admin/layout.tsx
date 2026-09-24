import { requireAdmin } from "@/server/session"

/** /admin/* — admins of the app's organization only; anyone else gets the 403 page. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return children
}
