import { getKysely } from "@/server/db/pool"

import { handleWebhook } from "../webhook"
import { findProvider } from "../registry"

/**
 * POST /api/payments/webhook/<provider> — el shim vive en
 * app/api/payments/webhook/[provider]/route.ts (lo escribe `pnpm modules:sync`).
 * Es una ruta pública: la autenticación la hace el proveedor en `parseWebhook`.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> }
): Promise<Response> {
  const { provider } = await ctx.params
  return handleWebhook(() => findProvider(provider), req, getKysely())
}
