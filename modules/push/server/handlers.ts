/**
 * The HTTP handlers, with every dependency injected so the tests run them
 * without Next, Better Auth or a database. server/subscribe/route.ts and
 * server/sw/route.ts wire the real ones.
 */
import { SERVICE_WORKER_SOURCE } from "./sw-script"
import { unsubscribeBodySchema, validateSubscription, type ValidSubscription } from "./subscription"

export type SubscribeErrorCode =
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "endpoint_not_allowed"
  | "not_configured"
  | "failed"

const STATUS: Record<SubscribeErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  bad_request: 400,
  endpoint_not_allowed: 422,
  not_configured: 503,
  failed: 500,
}

const NO_STORE = { "cache-control": "no-store" }

export function errorResponse(code: SubscribeErrorCode): Response {
  return Response.json({ error: code }, { status: STATUS[code], headers: NO_STORE })
}

/** Small JSON only: a PushSubscription is well under 1 KB. */
const MAX_BODY = 4 * 1024

export type SubscribeDeps = {
  /** The signed-in user's id, or null. */
  userId: () => Promise<string | null>
  /** `push:subscribe` for the signed-in user. */
  canSubscribe: () => Promise<boolean>
  configured: () => boolean
  save: (userId: string, sub: ValidSubscription) => Promise<void>
  removeOwn: (userId: string, endpoint: string) => Promise<number>
  log?: (msg: string, detail?: Record<string, unknown>) => void
}

/**
 * Same-origin JSON only. A cross-site page cannot send `application/json`
 * without a CORS preflight (which this route never answers), and when the
 * browser sends `Origin` it must be this host: no CSRF through the cookie.
 */
function sameOriginJson(req: Request): boolean {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (type !== "application/json") return false
  const origin = req.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return false
    } catch {
      return false
    }
  }
  return true
}

async function readJson(req: Request): Promise<unknown | undefined> {
  const declared = Number(req.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > MAX_BODY) return undefined
  try {
    const text = await req.text()
    if (text.length > MAX_BODY) return undefined
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

async function gate(req: Request, deps: SubscribeDeps): Promise<{ userId: string } | Response> {
  const userId = await deps.userId()
  if (!userId) return errorResponse("unauthorized")
  if (!sameOriginJson(req)) return errorResponse("bad_request")
  if (!(await deps.canSubscribe())) return errorResponse("forbidden")
  return { userId }
}

/** POST /api/push/subscribe — body: `PushSubscription.toJSON()`. 201 `{ ok: true }`. */
export async function handleSubscribe(req: Request, deps: SubscribeDeps): Promise<Response> {
  const g = await gate(req, deps)
  if (g instanceof Response) return g
  if (!deps.configured()) return errorResponse("not_configured")
  const raw = await readJson(req)
  if (raw === undefined) return errorResponse("bad_request")
  const check = validateSubscription(raw)
  if (!check.ok) return errorResponse(check.error)
  try {
    await deps.save(g.userId, check.value)
  } catch (err) {
    deps.log?.("push: could not save subscription", { error: (err as Error).name })
    return errorResponse("failed")
  }
  return Response.json({ ok: true }, { status: 201, headers: NO_STORE })
}

/** DELETE /api/push/subscribe — body `{ endpoint }`; only the caller's own row. 200 `{ removed }`. */
export async function handleUnsubscribe(req: Request, deps: SubscribeDeps): Promise<Response> {
  const g = await gate(req, deps)
  if (g instanceof Response) return g
  const parsed = unsubscribeBodySchema.safeParse(await readJson(req))
  if (!parsed.success) return errorResponse("bad_request")
  try {
    const removed = await deps.removeOwn(g.userId, parsed.data.endpoint)
    return Response.json({ removed }, { status: 200, headers: NO_STORE })
  } catch (err) {
    deps.log?.("push: could not delete subscription", { error: (err as Error).name })
    return errorResponse("failed")
  }
}

/**
 * GET /api/push/sw — the service worker. Its default (and maximum) scope is
 * /api/push/, which is all it needs: push and notificationclick fire for a
 * registration whatever its scope, and a narrow scope never collides with an
 * app's own service worker at "/". `no-cache` so browsers pick up updates.
 */
export function handleServiceWorker(): Response {
  return new Response(SERVICE_WORKER_SOURCE, {
    status: 200,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
    },
  })
}
