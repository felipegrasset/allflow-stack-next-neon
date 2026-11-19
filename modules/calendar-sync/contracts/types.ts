/** Types of the calendar-sync module. Pure: safe in server and client code. */

/** Why an account stopped syncing. `user`: they disconnected; `revoked`: Google refused the refresh token; `scope`: the calendar permission is missing. */
export const DISCONNECT_REASONS = ["user", "revoked", "scope"] as const
export type DisconnectReason = (typeof DISCONNECT_REASONS)[number]

export type AccountStatus = "connected" | "disconnected"

/** What a screen may know about an account: never a token. */
export type CalendarAccountView = {
  userId: string
  status: AccountStatus
  disconnectReason: DisconnectReason | null
  calendarId: string
  connectedAt: Date
  updatedAt: Date
}

/** State of one booking's event in Google. */
export const SYNC_STATES = ["pending", "synced", "failed", "skipped"] as const
export type SyncState = (typeof SYNC_STATES)[number]

/**
 * The booking as calendar-sync needs it. `Booking` and `BookingWithDetails`
 * of `@/modules/bookings/contracts` both fit once `resourceName` and
 * `timezone` are added (`contracts/index.ts` resolves them for a `Booking`).
 */
export type BookingSnapshot = {
  id: string
  userId: string
  status: "confirmed" | "cancelled"
  startsAt: Date
  endsAt: Date
  resourceName: string
  /** IANA zone of the resource: how Google shows the times. */
  timezone: string
}

/**
 * Result of syncing one booking. Never thrown: the booking is the source of
 * truth and stays as it is whatever Google answers.
 * - `synced`: the event exists in Google as the booking says.
 * - `deleted`: the booking is cancelled and its event is gone.
 * - `unchanged`: already in sync (no call to Google).
 * - `no_account` / `disconnected`: the booking's owner has no working
 *   connection; recorded, and sent when they (re)connect.
 * - `retry`: Google failed for now; the reconciliation retries it.
 * - `failed`: Google refused it for good (or too many attempts).
 * - `not_configured`: the module's env is incomplete.
 */
export type SyncOutcome =
  | "synced"
  | "deleted"
  | "unchanged"
  | "no_account"
  | "disconnected"
  | "retry"
  | "failed"
  | "not_configured"

export type ReconcileResult = {
  /** Rows retried because they were pending or failed and due. */
  retried: number
  /** Bookings looked at in the connected accounts' window. */
  scanned: number
  /** Outcome counts of every booking touched. */
  outcomes: Partial<Record<SyncOutcome, number>>
}
