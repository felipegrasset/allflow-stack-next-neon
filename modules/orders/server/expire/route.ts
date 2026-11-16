/**
 * GET|POST /api/orders/expire — the scheduled task that expires pending
 * orders and gives their stock back. Public route, authenticated by
 * `CRON_SECRET` (Vercel Cron sends it as a Bearer token). Idempotent: a
 * second call finds nothing due. Answers counts only.
 *
 * Schedule it in the app's vercel.json (outside this module):
 *   { "crons": [{ "path": "/api/orders/expire", "schedule": "*\/10 * * * *" }] }
 * or, with the `jobs` module installed, register a job that calls
 * `expirePendingOrders()` (see MODULE.md).
 */
import { expirePendingOrders } from "../../contracts"
import { checkCronAuth } from "./auth"

export const dynamic = "force-dynamic"

async function handle(req: Request): Promise<Response> {
  const auth = checkCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET)
  if (auth === "not_configured") return Response.json({ status: "not_configured" }, { status: 503 })
  if (auth !== "ok") return Response.json({ status: "unauthorized" }, { status: 401 })
  try {
    const report = await expirePendingOrders()
    return Response.json({ status: "ok", ...report })
  } catch (e) {
    console.error("[orders] expire route failed", e instanceof Error ? e.name : "error")
    return Response.json({ status: "failed" }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
