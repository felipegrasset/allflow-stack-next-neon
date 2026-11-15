import { handleSubscribe, handleUnsubscribe } from "../handlers"
import { subscribeDeps } from "../runtime"

/**
 * POST / DELETE /api/push/subscribe — the shim lives in
 * app/api/push/subscribe/route.ts (written by `pnpm modules:sync`). Public for
 * the proxy: session, same-origin JSON and `push:subscribe` are checked here.
 */
export async function POST(req: Request): Promise<Response> {
  return handleSubscribe(req, subscribeDeps())
}

export async function DELETE(req: Request): Promise<Response> {
  return handleUnsubscribe(req, subscribeDeps())
}
