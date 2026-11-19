"use server"

import { revalidatePath } from "next/cache"

import { requireOnboardedUser } from "@/server/session"

import { canConnectCalendar, currentViewer } from "./authz"
import { disconnectAccount } from "./oauth"
import { config, log, oauthDeps, reconcileDeps } from "./runtime"
import { SETTINGS_PATH } from "./paths"
import { reconcile } from "./sync"

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; n?: number }
  | { status: "error"; code: "forbidden" | "not_configured" | "unknown" }

/**
 * Both actions take no input (the form only carries the button): the user
 * comes from the session, never from the form, so there is nothing to
 * validate. Reachable by direct POST: session + `calendar:connect` first.
 */
export async function disconnectAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  if (!(await canConnectCalendar())) return { status: "error", code: "forbidden" }
  try {
    await disconnectAccount(oauthDeps(currentViewer), session.user.id)
  } catch (err) {
    log("calendar-sync: disconnect failed", { error: err instanceof Error ? err.name : "unknown" })
    return { status: "error", code: "unknown" }
  }
  revalidatePath(SETTINGS_PATH)
  return { status: "ok" }
}

/** Reconcile only the signed-in person's bookings (capped). */
export async function syncNowAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  if (!(await canConnectCalendar())) return { status: "error", code: "forbidden" }
  if (!config().ok) return { status: "error", code: "not_configured" }
  try {
    const r = await reconcile(reconcileDeps(), { userId: session.user.id, maxBookings: 100 })
    revalidatePath(SETTINGS_PATH)
    return { status: "ok", n: r.scanned }
  } catch (err) {
    log("calendar-sync: sync now failed", { error: err instanceof Error ? err.name : "unknown" })
    return { status: "error", code: "unknown" }
  }
}
