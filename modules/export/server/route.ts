import { handleExport } from "./handler"
import { realDeps } from "./wire"

/**
 * GET /api/export/<id> — the shim lives in app/api/export/[id]/route.ts
 * (written by `pnpm modules:sync`). Public for the proxy: the session and the
 * destination's permission are checked in the handler.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params
  return handleExport(id, req, realDeps())
}
