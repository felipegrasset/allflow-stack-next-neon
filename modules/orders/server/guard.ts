import { forbidden } from "next/navigation"

import { type Session } from "@/server/auth"
import { can } from "@/server/module-access"
import { requireOnboardedUser } from "@/server/session"

export type OrderAction = "read" | "manage"

/**
 * `order:<action>` for the signed-in person in the app's organization, through
 * Better Auth (static and dynamic roles). `can()` of server/module-access
 * casts the body, so the `order` resource type-checks before `modules:sync`
 * registers it. Cached per request.
 */
export const canOrder = (action: OrderAction): Promise<boolean> => can({ order: [action] })

/** Pages: signed in and onboarded (else /login or /onboarding), and the permission (else 403). */
export async function requirePagePermission(next: string, action: OrderAction): Promise<Session> {
  const session = await requireOnboardedUser(next)
  if (!(await canOrder(action))) forbidden()
  return session
}

/** Server Actions: same check, null instead of the 403 page. Call it BEFORE touching data. */
export async function actionSession(next: string, action: OrderAction): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  if (!(await canOrder(action))) return null
  return session
}

/** Who looks at an order: its owner, or anyone with `order:manage`. */
export type Viewer = { userId: string; canManage: boolean }
export const canSeeOrder = (viewer: Viewer, order: { userId: string }) =>
  viewer.canManage || order.userId === viewer.userId
