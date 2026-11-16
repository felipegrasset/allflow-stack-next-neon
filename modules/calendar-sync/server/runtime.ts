/**
 * The real dependencies (env, Postgres, Google over fetch, notifications,
 * bookings), shared by contracts/, the route handlers and the actions.
 */
import { listBookings } from "@/modules/bookings/contracts"
import { notify } from "@/modules/notifications/contracts"
import { publicUrl } from "@/lib/site"
import { getKysely } from "@/server/db/pool"

import type { DisconnectReason } from "../contracts/types"
import { es } from "../messages"
import { readConfig, type CalendarConfig } from "./config"
import { googleClient } from "./google"
import type { OAuthDeps } from "./oauth"
import { SETTINGS_PATH } from "./paths"
import { toSnapshot } from "./snapshot"
import { kyselyStore, type CalendarSyncStore } from "./store"
import type { ReconcileDeps, SyncDeps } from "./sync"

const copy = es["calendar-sync"]

/** redirect_uri and return URL come from the app URL (lib/site.ts), never from a request. */
export const config = (): CalendarConfig => readConfig(process.env, publicUrl())

export const store = (): CalendarSyncStore => kyselyStore(getKysely())

/** Codes and ids only: callers never pass tokens, names or notes. */
export const log = (msg: string, meta?: Record<string, unknown>) => console.info(msg, meta ?? {})

const google = (cfg: Extract<CalendarConfig, { ok: true }>) =>
  googleClient({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri })

/** In-app notice when Google cuts the access (Spanish source text: runs inside a job). */
async function notifyDisconnected(userId: string, reason: DisconnectReason): Promise<void> {
  await notify({
    // One notice per disconnection day and reason (idempotent if retried).
    id: `calendar-sync-disconnected-${userId}-${reason}-${new Date().toISOString().slice(0, 10)}`,
    userId,
    kind: "warning",
    title: copy.notify.disconnectedTitle,
    body: copy.notify.disconnectedBody,
    href: SETTINGS_PATH,
  })
}

export function syncDeps(): SyncDeps {
  const cfg = config()
  return {
    store: store(),
    ready: cfg.ok ? { google: google(cfg), keys: cfg.keys } : null,
    now: () => new Date(),
    log,
    onDisconnected: notifyDisconnected,
    text: {
      summary: (resource) => copy.event.summary.replace("{resource}", resource),
      description: copy.event.description,
    },
  }
}

export function reconcileDeps(): ReconcileDeps {
  return {
    ...syncDeps(),
    listBookings: async ({ from, to, userId }) =>
      (await listBookings({ from, to, userId, includeCancelled: true })).map(toSnapshot),
  }
}

export function oauthDeps(viewer: OAuthDeps["viewer"]): OAuthDeps {
  return {
    config,
    viewer,
    store: store(),
    google,
    now: () => new Date(),
    log,
  }
}
