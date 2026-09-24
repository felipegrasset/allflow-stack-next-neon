import { cache } from "react"
import { headers } from "next/headers"
import { forbidden, redirect } from "next/navigation"

import { sql } from "@/lib/db"
import { auth, type Session } from "@/server/auth"
import { DEFAULT_ORG_SLUG } from "@/server/auth/bootstrap"

/**
 * Route guards for Server Components, layouts and Server Actions. The proxy
 * (proxy.ts) only does an optimistic cookie check; THESE are the real checks,
 * and every Server Action must call one — actions are reachable by direct POST.
 */

/** One session lookup per request, however many components ask. */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({ headers: await headers() })
})

/** Signed in, or off to /login (with ?next= so login returns here). */
export async function requireUser(next?: string): Promise<Session> {
  const session = await getSession()
  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login")
  return session
}

/** The onboarding gate: signed in AND finished (or skipped) /onboarding. */
export async function requireOnboardedUser(next?: string): Promise<Session> {
  const session = await requireUser(next)
  if (!session.user.onboardedAt) redirect("/onboarding")
  return session
}

export const getDefaultOrganizationId = cache(async (): Promise<string | null> => {
  const rows = await sql<{ id: string }>`select id from organization where slug = ${DEFAULT_ORG_SLUG} limit 1`
  return rows[0]?.id ?? null
})

/** The user's role in the app's organization, or null if not a member. */
export const getAppRole = cache(async (userId: string): Promise<string | null> => {
  const rows = await sql<{ role: string }>`
    select m.role
    from member m
    join organization o on o.id = m."organizationId"
    where o.slug = ${DEFAULT_ORG_SLUG} and m."userId" = ${userId}
    limit 1`
  return rows[0]?.role ?? null
})

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && role.split(",").some((r) => r.trim() === "admin" || r.trim() === "owner")
}

/** Admin of the app's organization, or the 403 page (app/forbidden.tsx). */
export async function requireAdmin(next?: string): Promise<{ session: Session; role: string }> {
  const session = await requireOnboardedUser(next)
  const role = await getAppRole(session.user.id)
  if (!isAdminRole(role)) forbidden()
  return { session, role: role! }
}
