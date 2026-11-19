"use server"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { canSubscribe } from "./authz"
import { SETTINGS_PATH } from "./paths"
import { sendPush } from "./push"

export type TestActionState =
  | { status: "idle" }
  | { status: "ok"; sent: number; removed: number; failed: number }
  | { status: "error"; code: "forbidden" | "not_configured" | "no_devices" | "unknown" }

/**
 * Sends a test push to the CALLER's own devices only. No input to validate
 * (the form carries nothing); session and `push:subscribe` checked first.
 */
export async function sendTestAction(_prev: TestActionState, _formData: FormData): Promise<TestActionState> {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  if (!(await canSubscribe())) return { status: "error", code: "forbidden" }
  const copy = await getModuleCopy(es)
  try {
    const r = await sendPush(
      session.user.id,
      { title: copy.test.pushTitle, body: copy.test.pushBody, href: SETTINGS_PATH, tag: "push-test" },
      { ttl: 60, urgency: "normal" }
    )
    if (!r.configured) return { status: "error", code: "not_configured" }
    if (r.devices === 0) return { status: "error", code: "no_devices" }
    return { status: "ok", sent: r.sent, removed: r.removed, failed: r.failed }
  } catch {
    return { status: "error", code: "unknown" }
  }
}
