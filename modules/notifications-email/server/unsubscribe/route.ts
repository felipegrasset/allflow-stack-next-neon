import { getKysely } from "@/server/db/pool"

import { verifyUnsubscribeToken } from "../../contracts/token"
import { en, es } from "../../messages"
import { setEnabledWith } from "../store"

/**
 * GET|POST /notifications/unsubscribe?token=… — the shim lives in
 * app/notifications/unsubscribe/route.ts (written by `pnpm modules:sync`).
 * Public route: the signed token is the authentication. One click, no login.
 * It can only turn emails OFF for the person the token names.
 * POST is there for mail clients that use RFC 8058 one-click unsubscribe.
 */
const page = (title: string, body: string, status: number) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
      `<h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  )

async function handle(req: Request): Promise<Response> {
  const english = (req.headers.get("accept-language") ?? "").toLowerCase().startsWith("en")
  const t = (english ? en : es)["notifications-email"].unsubscribe
  const token = new URL(req.url).searchParams.get("token")
  const userId = verifyUnsubscribeToken(token, process.env.BETTER_AUTH_SECRET)
  if (!userId) return page(t.badTitle, t.badBody, 400)
  try {
    await setEnabledWith(getKysely(), userId, false)
  } catch (err) {
    console.error("[notifications-email] unsubscribe failed", err)
    return page(t.badTitle, t.badBody, 500)
  }
  return page(t.doneTitle, t.doneBody, 200)
}

export const GET = handle
export const POST = handle
