/** Routes of the module (also in manifest.json). */
export const CONNECT_PATH = "/api/calendar-sync/connect"
export const CALLBACK_PATH = "/api/calendar-sync/callback"
export const SETTINGS_PATH = "/settings/calendar"

/** What /settings/calendar?status= may say after the OAuth round trip. */
export const RETURN_STATUSES = ["connected", "denied", "scope", "state", "error", "not_configured"] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]
export const isReturnStatus = (s: unknown): s is ReturnStatus =>
  typeof s === "string" && (RETURN_STATUSES as readonly string[]).includes(s)
