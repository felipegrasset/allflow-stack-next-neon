import { handleServiceWorker } from "../handlers"

/** GET /api/push/sw — the service worker script (public, no data). Shim: app/api/push/sw/route.ts. */
export function GET(): Response {
  return handleServiceWorker()
}
