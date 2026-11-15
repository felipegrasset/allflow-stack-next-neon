/**
 * The real dependencies (Postgres, env provider, notifications), shared by
 * contracts/index.ts, the route and the admin actions.
 */
import { notify } from "@/modules/notifications/contracts"
import { getKysely } from "@/server/db/pool"

import { es } from "../messages"
import { providerFromEnv } from "./config"
import { maskPhone } from "./phone"
import type { SendDeps } from "./send"
import { kyselyStore, type WhatsAppStore } from "./store"

export const store = (): WhatsAppStore => kyselyStore(getKysely())

export const log = (msg: string, meta?: Record<string, unknown>) =>
  console.info(msg, meta ?? {})

export const sendDeps = (): SendDeps => ({
  store: store(),
  provider: () => providerFromEnv(),
  log,
})

/**
 * In-app notice to whoever sent a message that Meta reported as failed. The
 * text is the source catalog (Spanish): it runs inside Meta's webhook, with
 * no visitor locale. Idempotent per message; a failure here is logged and
 * swallowed (the receipt is already stored).
 */
export async function notifySendFailed(m: {
  messageId: string
  sentBy: string
  phone: string
}): Promise<void> {
  try {
    await notify({
      id: `whatsapp-failed-${m.messageId}`,
      userId: m.sentBy,
      kind: "error",
      title: es.whatsapp.notify.failedTitle.replace("{phone}", maskPhone(m.phone)),
      body: es.whatsapp.notify.failedBody,
      href: "/admin/whatsapp",
    })
  } catch (err) {
    log("whatsapp: notify failed", { error: err instanceof Error ? err.name : "unknown" })
  }
}
