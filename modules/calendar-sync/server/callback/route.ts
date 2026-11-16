import { currentViewer } from "../authz"
import { handleCallback } from "../oauth"
import { oauthDeps, reconcileDeps } from "../runtime"
import { reconcile } from "../sync"

/**
 * GET /api/calendar-sync/callback — Google returns here (the exact URL
 * registered in Google Cloud Console: <app URL>/api/calendar-sync/callback).
 * Public for the proxy: the handler checks the session, `calendar:connect`
 * and the signed, single-use state. After connecting, the person's upcoming
 * bookings are sent (best effort, capped).
 */
export function GET(req: Request): Promise<Response> {
  return handleCallback(req, {
    ...oauthDeps(currentViewer),
    afterConnect: async (userId) => {
      await reconcile(reconcileDeps(), { userId, maxBookings: 50 })
    },
  })
}
