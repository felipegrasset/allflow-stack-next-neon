import { currentViewer } from "../authz"
import { handleConnect } from "../oauth"
import { oauthDeps } from "../runtime"

/**
 * GET /api/calendar-sync/connect — the shim (app/api/calendar-sync/connect/route.ts)
 * is written by `pnpm modules:sync`. Public for the proxy: the handler checks
 * the session and `calendar:connect`, then sends the person to Google.
 */
export function GET(req: Request): Promise<Response> {
  return handleConnect(req, oauthDeps(currentViewer))
}
