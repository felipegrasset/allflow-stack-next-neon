import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/**
 * Optimistic auth redirect: no session cookie on a private route → /login
 * with ?next= so login returns here. It only checks that the cookie EXISTS
 * (no database round-trip); the real checks are in server/session.ts, called
 * by the layouts, pages and Server Actions.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  const url = new URL("/login", request.url)
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/settings/:path*", "/admin/:path*", "/onboarding"],
}
