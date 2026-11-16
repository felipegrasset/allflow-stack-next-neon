/**
 * The sync engine: bookings → Google Calendar, one way, best effort.
 *
 * - The booking (bookings module) is the source of truth. Nothing here throws
 *   to the caller or touches a booking: a Google failure becomes a row state
 *   and a retry, never an undone booking.
 * - Idempotent per booking: one row in calendar_sync_events with a
 *   deterministic event id (crypto.eventIdFor). The desired state is written
 *   BEFORE calling Google, so a crash between the two is retried; an
 *   unchanged booking (same fingerprint, already synced) costs no call.
 * - Access tokens are refreshed when they expire (60 s margin) and once more
 *   on a 401. `invalid_grant` on refresh, or a 403 without the calendar
 *   permission, disconnects the account (tokens wiped) and notifies its owner
 *   once; their bookings stay recorded as `skipped` and go out when they
 *   reconnect (reconcile).
 * - Logs carry the booking id, the outcome and a short code: never a token,
 *   a name, a note or Google's error text.
 *
 * Everything is injected (store, Google client, keys, clock, log, notice), so
 * tests/ run it without network or database.
 */
import type {
  BookingSnapshot,
  DisconnectReason,
  ReconcileResult,
  SyncOutcome,
} from "../contracts/types"
import { aadFor, decryptSecret, encryptSecret, eventIdFor, fingerprintOf, type DerivedKeys } from "./crypto"
import { hasCalendarScope, type CallResult, type EventBody, type GoogleClient } from "./google"
import type { AccountRow, CalendarSyncStore, EventRow } from "./store"

export type Log = (msg: string, meta?: Record<string, unknown>) => void

export type SyncDeps = {
  store: CalendarSyncStore
  /** null when GOOGLE_CLIENT_ID / _SECRET / CALENDAR_SYNC_KEY are missing or invalid. */
  ready: { google: GoogleClient; keys: DerivedKeys } | null
  now: () => Date
  log: Log
  /** Tell the owner their calendar stopped syncing. Called once per disconnection; its failure is logged. */
  onDisconnected: (userId: string, reason: DisconnectReason) => Promise<void>
  /** Text of the event (the source catalog: this runs without a visitor's locale). */
  text: { summary: (resourceName: string) => string; description: string }
}

export type ReconcileDeps = SyncDeps & {
  /** Bookings of one user overlapping [from, to), cancelled ones included (bookings/contracts listBookings). */
  listBookings: (q: { from: Date; to: Date; userId: string }) => Promise<BookingSnapshot[]>
}

/** Wait before retry n (1-based). After the last one the row stays `failed`. */
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000, 24 * 3_600_000]
export const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1
const EXPIRY_MARGIN_MS = 60_000

type TokenOutcome = { ok: true; token: string } | { ok: false; outcome: "disconnected" | "retry"; code: string }

async function disconnect(deps: SyncDeps, userId: string, reason: DisconnectReason): Promise<void> {
  const changed = await deps.store.markDisconnected(userId, reason, deps.now())
  deps.log("calendar-sync: account disconnected", { reason, notified: changed })
  if (!changed) return
  try {
    await deps.onDisconnected(userId, reason)
  } catch (err) {
    deps.log("calendar-sync: notice failed", { error: err instanceof Error ? err.name : "unknown" })
  }
}

/** A usable access token: the stored one while valid, else a refresh (stored encrypted). */
export async function accessTokenFor(
  deps: SyncDeps,
  account: AccountRow,
  opts: { force?: boolean } = {}
): Promise<TokenOutcome> {
  if (!deps.ready) return { ok: false, outcome: "retry", code: "not_configured" }
  const { google, keys } = deps.ready
  const now = deps.now()
  if (
    !opts.force &&
    account.accessTokenEnc &&
    account.accessExpiresAt &&
    account.accessExpiresAt.getTime() - EXPIRY_MARGIN_MS > now.getTime()
  ) {
    try {
      return { ok: true, token: decryptSecret(keys.enc, account.accessTokenEnc, aadFor.access(account.userId)) }
    } catch {
      // Unreadable cached token: fall through to a refresh.
    }
  }
  if (!account.refreshTokenEnc) {
    await disconnect(deps, account.userId, "revoked")
    return { ok: false, outcome: "disconnected", code: "no_refresh_token" }
  }
  let refreshToken: string
  try {
    refreshToken = decryptSecret(keys.enc, account.refreshTokenEnc, aadFor.refresh(account.userId))
  } catch {
    // CALENDAR_SYNC_KEY changed (or the row was tampered with): the token is lost, ask to reconnect.
    await disconnect(deps, account.userId, "revoked")
    return { ok: false, outcome: "disconnected", code: "undecryptable" }
  }
  const r = await google.refresh(refreshToken)
  if (!r.ok) {
    if (r.revoked) {
      await disconnect(deps, account.userId, "revoked")
      return { ok: false, outcome: "disconnected", code: r.code }
    }
    return { ok: false, outcome: "retry", code: r.code }
  }
  if (r.tokens.scope && !hasCalendarScope(r.tokens.scope)) {
    await disconnect(deps, account.userId, "scope")
    return { ok: false, outcome: "disconnected", code: "scope" }
  }
  const expiresAt = new Date(now.getTime() + r.tokens.expiresIn * 1000)
  await deps.store.updateAccessToken(
    account.userId,
    encryptSecret(keys.enc, r.tokens.accessToken, aadFor.access(account.userId)),
    expiresAt,
    now
  )
  return { ok: true, token: r.tokens.accessToken }
}

export function eventBody(row: EventRow, description: string): EventBody {
  return {
    summary: row.summary,
    description,
    start: { dateTime: row.startsAt.toISOString(), timeZone: row.timezone },
    end: { dateTime: row.endsAt.toISOString(), timeZone: row.timezone },
    status: "confirmed",
    extendedProperties: { private: { fulviaBookingId: row.bookingId } },
  }
}

async function finish(
  deps: SyncDeps,
  row: EventRow,
  state: EventRow["state"],
  patch: Partial<EventRow>,
  outcome: SyncOutcome,
  code?: string
): Promise<SyncOutcome> {
  const now = deps.now()
  await deps.store.putEvent({ ...row, ...patch, state, updatedAt: now })
  deps.log("calendar-sync: sync", { booking: row.bookingId, outcome, ...(code ? { code } : {}) })
  return outcome
}

function retryLater(deps: SyncDeps, row: EventRow, code: string): Promise<SyncOutcome> {
  const attempts = row.attempts + 1
  if (attempts >= MAX_ATTEMPTS)
    return finish(deps, row, "failed", { attempts, lastError: code, nextAttemptAt: null }, "failed", code)
  const wait = RETRY_BACKOFF_MS[attempts - 1]
  return finish(
    deps,
    row,
    "failed",
    { attempts, lastError: code, nextAttemptAt: new Date(deps.now().getTime() + wait) },
    "retry",
    code
  )
}

/** Send one row's desired state to Google (create/update or delete). */
export async function pushRow(deps: SyncDeps, row: EventRow): Promise<SyncOutcome> {
  if (!deps.ready) return "not_configured"
  const { google } = deps.ready
  const account = await deps.store.getAccount(row.userId)
  if (!account)
    return finish(deps, row, "skipped", { nextAttemptAt: null, lastError: null }, "no_account")
  if (account.status !== "connected")
    return finish(deps, row, "skipped", { nextAttemptAt: null, lastError: null }, "disconnected")

  const send = (token: string): Promise<CallResult> =>
    row.desired === "confirmed"
      ? google.upsertEvent(token, account.calendarId, row.eventId, eventBody(row, deps.text.description))
      : google.deleteEvent(token, account.calendarId, row.eventId)

  let t = await accessTokenFor(deps, account)
  if (!t.ok) {
    return t.outcome === "disconnected"
      ? finish(deps, row, "skipped", { nextAttemptAt: null, lastError: t.code }, "disconnected", t.code)
      : retryLater(deps, row, t.code)
  }
  let r = await send(t.token)
  if (!r.ok && r.kind === "unauthorized") {
    // The cached token was revoked or rotated: refresh once and retry once.
    t = await accessTokenFor(deps, account, { force: true })
    if (!t.ok) {
      return t.outcome === "disconnected"
        ? finish(deps, row, "skipped", { nextAttemptAt: null, lastError: t.code }, "disconnected", t.code)
        : retryLater(deps, row, t.code)
    }
    r = await send(t.token)
  }
  if (r.ok) {
    return finish(
      deps,
      row,
      "synced",
      { attempts: 0, lastError: null, nextAttemptAt: null, syncedAt: deps.now(), calendarId: account.calendarId },
      row.desired === "confirmed" ? "synced" : "deleted"
    )
  }
  if (r.kind === "scope") {
    await disconnect(deps, row.userId, "scope")
    return finish(deps, row, "skipped", { nextAttemptAt: null, lastError: r.code }, "disconnected", r.code)
  }
  if (r.kind === "rejected")
    return finish(deps, row, "failed", { attempts: row.attempts + 1, lastError: r.code, nextAttemptAt: null }, "failed", r.code)
  return retryLater(deps, row, r.code)
}

/**
 * Bring the booking's event in line with the booking. Safe to call any number
 * of times, from anywhere (after creating or cancelling, from a job). Never
 * throws for a Google or connection problem; a database error does throw (the
 * caller of the contract swallows it, see contracts/index.ts).
 */
export async function syncBooking(deps: SyncDeps, b: BookingSnapshot): Promise<SyncOutcome> {
  const now = deps.now()
  const summary = deps.text.summary(b.resourceName).slice(0, 250)
  const fingerprint = fingerprintOf([b.status, b.startsAt.toISOString(), b.endsAt.toISOString(), summary, b.timezone])
  const prev = await deps.store.getEvent(b.id)
  if (prev && prev.state === "synced" && prev.fingerprint === fingerprint) return "unchanged"
  // Cancelled and never recorded: no event was ever created, nothing to remove.
  if (!prev && b.status === "cancelled") return "unchanged"
  const same = prev?.fingerprint === fingerprint
  const row: EventRow = {
    bookingId: b.id,
    userId: b.userId,
    eventId: prev?.eventId ?? eventIdFor(b.id, b.userId),
    calendarId: prev?.calendarId ?? "primary",
    desired: b.status,
    state: "pending",
    fingerprint,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    summary,
    timezone: b.timezone,
    attempts: same && prev ? prev.attempts : 0,
    lastError: prev?.lastError ?? null,
    nextAttemptAt: now,
    syncedAt: prev?.syncedAt ?? null,
    updatedAt: now,
  }
  // A fixed row (too many attempts, or rejected) is only retried when the booking changes.
  if (same && prev && prev.state === "failed" && prev.nextAttemptAt === null) return "failed"
  // Waiting for its retry time: the reconciliation will send it.
  if (same && prev && prev.state === "failed" && prev.nextAttemptAt && prev.nextAttemptAt > now) return "retry"
  await deps.store.putEvent(row)
  return pushRow(deps, row)
}

/**
 * The scheduled job. Idempotent; run it every few minutes.
 * 1. Retries the rows that are due (pending or failed with a retry time).
 * 2. For each connected account (or only `userId`), compares its bookings in
 *    [now − lookback, now + horizon] with their events: picks up bookings
 *    created or cancelled without calling the hook, and those recorded while
 *    the account was disconnected.
 * 3. Deletes expired OAuth states.
 */
export async function reconcile(
  deps: ReconcileDeps,
  opts: { userId?: string; horizonDays?: number; lookbackHours?: number; maxBookings?: number; maxRetries?: number } = {}
): Promise<ReconcileResult> {
  const result: ReconcileResult = { retried: 0, scanned: 0, outcomes: {} }
  if (!deps.ready) return result
  const count = (o: SyncOutcome) => (result.outcomes[o] = (result.outcomes[o] ?? 0) + 1)
  const now = deps.now()
  await deps.store.purgeExpiredStates(now)

  if (!opts.userId) {
    for (const row of await deps.store.listDueEvents(now, opts.maxRetries ?? 100)) {
      result.retried++
      count(await pushRow(deps, row))
    }
  }

  const horizon = (opts.horizonDays ?? 60) * 86_400_000
  const lookback = (opts.lookbackHours ?? 24) * 3_600_000
  const maxBookings = opts.maxBookings ?? 500
  let users: string[]
  if (opts.userId) {
    const a = await deps.store.getAccount(opts.userId)
    users = a?.status === "connected" ? [opts.userId] : []
  } else {
    users = await deps.store.listConnectedUserIds(200)
  }
  for (const userId of users) {
    if (result.scanned >= maxBookings) break
    let bookings: BookingSnapshot[]
    try {
      bookings = await deps.listBookings({
        from: new Date(now.getTime() - lookback),
        to: new Date(now.getTime() + horizon),
        userId,
      })
    } catch (err) {
      deps.log("calendar-sync: list bookings failed", { error: err instanceof Error ? err.name : "unknown" })
      continue
    }
    for (const b of bookings) {
      if (result.scanned >= maxBookings) break
      result.scanned++
      count(await syncBooking(deps, b))
    }
  }
  return result
}
