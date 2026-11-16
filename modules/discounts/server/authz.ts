import { can } from "@/server/module-access"

/**
 * `discount:manage` for the signed-in person in the app's organization,
 * through Better Auth (static and dynamic roles). `can()` casts the body, so
 * the `discount` resource type-checks before `modules:sync` registers it.
 * Cached per request.
 */
export const canManageDiscounts = (): Promise<boolean> => can({ discount: ["manage"] })
