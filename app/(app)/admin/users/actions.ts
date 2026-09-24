"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { profileCopy } from "@/lib/copy/profile"
import { sql } from "@/lib/db"
import type { FormResult } from "@/lib/schemas/auth"
import { removeMemberSchema, updateRoleSchema } from "@/lib/schemas/profile"
import { auth } from "@/server/auth"
import { getDefaultOrganizationId, requireAdmin } from "@/server/session"

/**
 * Role changes go through the Better Auth organization plugin
 * (updateMemberRole / removeMember), which checks the caller's permissions
 * against lib/permissions.ts and the "organizationRole" table again.
 * An admin can't demote or remove themselves here: that is how an app ends
 * up with no admin at all.
 */

async function isSelf(memberId: string, userId: string): Promise<boolean> {
  const rows = await sql<{ userId: string }>`select "userId" from member where id = ${memberId} limit 1`
  return rows[0]?.userId === userId
}

export async function updateMemberRoleAction(input: unknown): Promise<FormResult<never>> {
  const { session } = await requireAdmin("/admin/users")
  const parsed = updateRoleSchema.safeParse(input)
  const organizationId = await getDefaultOrganizationId()
  if (!parsed.success || !organizationId) return { ok: false, formError: profileCopy.adminUsers.failed }
  if (await isSelf(parsed.data.memberId, session.user.id)) return { ok: false, formError: profileCopy.common.notAllowed }
  try {
    await auth.api.updateMemberRole({
      body: { memberId: parsed.data.memberId, role: parsed.data.role, organizationId },
      headers: await headers(),
    })
  } catch (err) {
    console.error("[admin:updateRole]", err)
    return { ok: false, formError: profileCopy.adminUsers.failed }
  }
  revalidatePath("/admin/users")
  return { ok: true }
}

export async function removeMemberAction(input: unknown): Promise<FormResult<never>> {
  const { session } = await requireAdmin("/admin/users")
  const parsed = removeMemberSchema.safeParse(input)
  const organizationId = await getDefaultOrganizationId()
  if (!parsed.success || !organizationId) return { ok: false, formError: profileCopy.adminUsers.failed }
  if (await isSelf(parsed.data.memberId, session.user.id)) return { ok: false, formError: profileCopy.common.notAllowed }
  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: parsed.data.memberId, organizationId },
      headers: await headers(),
    })
  } catch (err) {
    console.error("[admin:removeMember]", err)
    return { ok: false, formError: profileCopy.adminUsers.failed }
  }
  revalidatePath("/admin/users")
  return { ok: true }
}
