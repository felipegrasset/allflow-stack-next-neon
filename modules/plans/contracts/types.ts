/** The view of `getEntitlements(subject)`: one database read, then sync checks. */
import type { PlanResolution } from "./domain"

export type Entitlements = PlanResolution & {
  /** Feature flag of the resolved plan. Unknown feature → false. */
  can(feature: string): boolean
  /** Limit of the resolved plan. `Infinity` = unlimited; unknown key → 0. */
  limit(key: string): number
  /** `used + adding <= limit(key)`; fails closed on bad input. */
  hasRoom(key: string, used: number, adding?: number): boolean
}
