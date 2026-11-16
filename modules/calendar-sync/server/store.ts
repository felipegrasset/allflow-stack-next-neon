/**
 * Persistence of calendar-sync behind an interface, so the sync and the OAuth
 * handlers are tested with an in-memory store (tests/) and run on Postgres
 * with `kyselyStore`. Only ciphertext goes in or out for tokens.
 */
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import type { AccountStatus, DisconnectReason, SyncState } from "../contracts/types"

export type AccountRow = {
  userId: string
  status: AccountStatus
  disconnectReason: DisconnectReason | null
  scopes: string
  calendarId: string
  accessTokenEnc: string | null
  accessExpiresAt: Date | null
  refreshTokenEnc: string | null
  connectedAt: Date
  updatedAt: Date
}

export type EventRow = {
  bookingId: string
  userId: string
  eventId: string
  calendarId: string
  desired: "confirmed" | "cancelled"
  state: SyncState
  fingerprint: string
  startsAt: Date
  endsAt: Date
  summary: string
  timezone: string
  attempts: number
  lastError: string | null
  nextAttemptAt: Date | null
  syncedAt: Date | null
  updatedAt: Date
}

export type StateRow = { nonce: string; userId: string; verifierEnc: string; expiresAt: Date }

export interface CalendarSyncStore {
  getAccount(userId: string): Promise<AccountRow | null>
  /** Insert or replace the user's account as connected with fresh (encrypted) tokens. */
  saveConnected(a: {
    userId: string
    scopes: string
    accessTokenEnc: string
    accessExpiresAt: Date
    refreshTokenEnc: string
    at: Date
  }): Promise<void>
  updateAccessToken(userId: string, accessTokenEnc: string, expiresAt: Date, at: Date): Promise<void>
  /** Wipes the tokens. Returns true only if it WAS connected (so the notice goes once). */
  markDisconnected(userId: string, reason: DisconnectReason, at: Date): Promise<boolean>
  listConnectedUserIds(limit: number): Promise<string[]>

  createState(s: StateRow): Promise<void>
  /** Deletes and returns the state if it belongs to `userId` and has not expired. Atomic: a second call gets null. */
  consumeState(nonce: string, userId: string, now: Date): Promise<StateRow | null>
  purgeExpiredStates(now: Date): Promise<number>

  getEvent(bookingId: string): Promise<EventRow | null>
  putEvent(row: EventRow): Promise<void>
  /** Pending or failed rows whose retry time has come, oldest first. */
  listDueEvents(now: Date, limit: number): Promise<EventRow[]>
  countEvents(userId: string): Promise<Record<SyncState, number>>
}

type Db = Kysely<Database>

export function kyselyStore(db: Db): CalendarSyncStore {
  return {
    async getAccount(userId) {
      const r = await db.selectFrom("calendar_sync_accounts").selectAll().where("user_id", "=", userId).executeTakeFirst()
      if (!r) return null
      return {
        userId: r.user_id,
        status: r.status,
        disconnectReason: r.disconnect_reason,
        scopes: r.scopes,
        calendarId: r.calendar_id,
        accessTokenEnc: r.access_token_enc,
        accessExpiresAt: r.access_expires_at,
        refreshTokenEnc: r.refresh_token_enc,
        connectedAt: r.connected_at,
        updatedAt: r.updated_at,
      }
    },

    async saveConnected(a) {
      const values = {
        status: "connected" as const,
        disconnect_reason: null,
        scopes: a.scopes,
        access_token_enc: a.accessTokenEnc,
        access_expires_at: a.accessExpiresAt,
        refresh_token_enc: a.refreshTokenEnc,
        connected_at: a.at,
        updated_at: a.at,
      }
      await db
        .insertInto("calendar_sync_accounts")
        .values({ user_id: a.userId, ...values })
        .onConflict((oc) => oc.column("user_id").doUpdateSet(values))
        .execute()
    },

    async updateAccessToken(userId, accessTokenEnc, expiresAt, at) {
      await db
        .updateTable("calendar_sync_accounts")
        .set({ access_token_enc: accessTokenEnc, access_expires_at: expiresAt, updated_at: at })
        .where("user_id", "=", userId)
        .where("status", "=", "connected")
        .execute()
    },

    async markDisconnected(userId, reason, at) {
      const res = await db
        .updateTable("calendar_sync_accounts")
        .set({
          status: "disconnected",
          disconnect_reason: reason,
          access_token_enc: null,
          access_expires_at: null,
          refresh_token_enc: null,
          updated_at: at,
        })
        .where("user_id", "=", userId)
        .where("status", "=", "connected")
        .executeTakeFirst()
      return Number(res.numUpdatedRows) > 0
    },

    async listConnectedUserIds(limit) {
      const rows = await db
        .selectFrom("calendar_sync_accounts")
        .select("user_id")
        .where("status", "=", "connected")
        .orderBy("updated_at")
        .limit(limit)
        .execute()
      return rows.map((r) => r.user_id)
    },

    async createState(s) {
      await db
        .insertInto("calendar_sync_states")
        .values({ nonce: s.nonce, user_id: s.userId, verifier_enc: s.verifierEnc, expires_at: s.expiresAt })
        .execute()
    },

    async consumeState(nonce, userId, now) {
      const r = await db
        .deleteFrom("calendar_sync_states")
        .where("nonce", "=", nonce)
        .where("user_id", "=", userId)
        .where("expires_at", ">", now)
        .returningAll()
        .executeTakeFirst()
      return r ? { nonce: r.nonce, userId: r.user_id, verifierEnc: r.verifier_enc, expiresAt: r.expires_at } : null
    },

    async purgeExpiredStates(now) {
      const res = await db.deleteFrom("calendar_sync_states").where("expires_at", "<=", now).executeTakeFirst()
      return Number(res.numDeletedRows)
    },

    async getEvent(bookingId) {
      const r = await db.selectFrom("calendar_sync_events").selectAll().where("booking_id", "=", bookingId).executeTakeFirst()
      return r ? toEventRow(r) : null
    },

    async putEvent(row) {
      const values = {
        user_id: row.userId,
        event_id: row.eventId,
        calendar_id: row.calendarId,
        desired: row.desired,
        state: row.state,
        fingerprint: row.fingerprint,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
        summary: row.summary,
        timezone: row.timezone,
        attempts: row.attempts,
        last_error: row.lastError,
        next_attempt_at: row.nextAttemptAt,
        synced_at: row.syncedAt,
        updated_at: row.updatedAt,
      }
      await db
        .insertInto("calendar_sync_events")
        .values({ booking_id: row.bookingId, ...values })
        .onConflict((oc) => oc.column("booking_id").doUpdateSet(values))
        .execute()
    },

    async listDueEvents(now, limit) {
      const rows = await db
        .selectFrom("calendar_sync_events")
        .selectAll()
        .where("state", "in", ["pending", "failed"])
        .where("next_attempt_at", "is not", null)
        .where("next_attempt_at", "<=", now)
        .orderBy("next_attempt_at")
        .limit(limit)
        .execute()
      return rows.map(toEventRow)
    },

    async countEvents(userId) {
      const rows = await db
        .selectFrom("calendar_sync_events")
        .select(["state", (eb) => eb.fn.countAll<string>().as("n")])
        .where("user_id", "=", userId)
        .groupBy("state")
        .execute()
      const out: Record<SyncState, number> = { pending: 0, synced: 0, failed: 0, skipped: 0 }
      for (const r of rows) out[r.state] = Number(r.n)
      return out
    },
  }
}

function toEventRow(r: {
  booking_id: string
  user_id: string
  event_id: string
  calendar_id: string
  desired: "confirmed" | "cancelled"
  state: SyncState
  fingerprint: string
  starts_at: Date
  ends_at: Date
  summary: string
  timezone: string
  attempts: number
  last_error: string | null
  next_attempt_at: Date | null
  synced_at: Date | null
  updated_at: Date
}): EventRow {
  return {
    bookingId: r.booking_id,
    userId: r.user_id,
    eventId: r.event_id,
    calendarId: r.calendar_id,
    desired: r.desired,
    state: r.state,
    fingerprint: r.fingerprint,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    summary: r.summary,
    timezone: r.timezone,
    attempts: r.attempts,
    lastError: r.last_error,
    nextAttemptAt: r.next_attempt_at,
    syncedAt: r.synced_at,
    updatedAt: r.updated_at,
  }
}
