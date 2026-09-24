import type { Metadata } from "next"
import { headers } from "next/headers"

import { profileCopy } from "@/lib/copy/profile"
import { auth } from "@/server/auth"
import { fault, slowIfFault, throwIfFault } from "@/server/e2e-faults"
import { getDefaultOrganizationId, requireAdmin } from "@/server/session"
import { UsersTable, type MemberRow } from "./users-table"

export const metadata: Metadata = { title: profileCopy.adminUsers.metaTitle }

/**
 * Admin of users: the members of the app's organization (every account joins
 * it on sign-up — server/auth/bootstrap.ts). Loading → loading.tsx (table
 * skeleton); failure → error.tsx (retry).
 */
export default async function AdminUsersPage() {
  const { session } = await requireAdmin("/admin/users")
  await slowIfFault()
  await throwIfFault("admin-users-error")
  const organizationId = await getDefaultOrganizationId()
  if (!organizationId) throw new Error("La organización de la app no existe: corre `pnpm db:migrate`.")

  const { members } = await auth.api.listMembers({
    query: { organizationId, limit: 500, sortBy: "createdAt", sortDirection: "asc" },
    headers: await headers(),
  })
  const listed = (await fault("admin-users-empty")) ? members.filter((m) => m.userId === session.user.id) : members
  const rows: MemberRow[] = listed.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image ?? null,
  }))
  const c = profileCopy.adminUsers

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{c.description}</p>
      </div>
      <UsersTable rows={rows} currentUserId={session.user.id} />
    </div>
  )
}
