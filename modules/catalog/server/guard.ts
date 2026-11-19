import { forbidden } from "next/navigation"

import { type Session } from "@/server/auth"
import { can } from "@/server/module-access"
import { requireOnboardedUser } from "@/server/session"

export type ItemAction = "read" | "write"

/**
 * `item:<action>` for the signed-in person in the app's organization, through
 * Better Auth (static and dynamic roles). `can()` of server/module-access
 * already casts the body, so the `item` resource type-checks before
 * `modules:sync` registers it. Cached per request.
 */
export const canItem = (action: ItemAction): Promise<boolean> => can({ item: [action] })

/** Pages: signed in and onboarded (else /login or /onboarding), and every permission (else 403). */
export async function requirePagePermission(next: string, ...needs: ItemAction[]): Promise<Session> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await canItem(a))) forbidden()
  return session
}

/** Server Actions: same check, null instead of the 403 page. Call it BEFORE touching data. */
export async function actionSession(next: string, ...needs: ItemAction[]): Promise<Session | null> {
  const session = await requireOnboardedUser(next)
  for (const a of needs) if (!(await canItem(a))) return null
  return session
}
