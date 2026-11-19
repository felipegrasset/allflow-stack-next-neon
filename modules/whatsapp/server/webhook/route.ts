import { readConfig } from "../config"
import { log, notifySendFailed, store } from "../runtime"
import { handleVerify, handleWebhook } from "../webhook"

/**
 * /api/whatsapp/webhook — the shim (app/api/whatsapp/webhook/route.ts) is
 * written by `pnpm modules:sync` and re-exports these verbs. Public route:
 * GET is Meta's handshake (verify token), POST is authenticated by its
 * HMAC signature. Uses node:crypto (Node runtime, the default for route handlers).
 */

export function GET(req: Request): Response {
  return handleVerify(req, { config: () => readConfig() })
}

export function POST(req: Request): Promise<Response> {
  return handleWebhook(req, {
    config: () => readConfig(),
    store,
    onFailed: notifySendFailed,
    log,
  })
}
