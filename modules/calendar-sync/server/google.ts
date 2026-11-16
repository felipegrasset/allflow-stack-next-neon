/**
 * Google OAuth 2.0 (web server flow) and Calendar API v3 over plain `fetch`
 * (no SDK, no new package). `fetch` is injected so tests use a fake one.
 *
 * Endpoints (Google Identity, "Using OAuth 2.0 for Web Server Applications",
 * https://developers.google.com/identity/protocols/oauth2/web-server):
 *   authorize  https://accounts.google.com/o/oauth2/v2/auth
 *   token      https://oauth2.googleapis.com/token   (code and refresh_token grants)
 *   revoke     https://oauth2.googleapis.com/revoke
 * A refresh token that was revoked or expired answers 400 `invalid_grant`.
 *
 * Calendar API v3 (https://developers.google.com/calendar/api/v3/reference):
 *   insert  POST   /calendar/v3/calendars/{calendarId}/events          (client `id` allowed)
 *   patch   PATCH  /calendar/v3/calendars/{calendarId}/events/{eventId}
 *   delete  DELETE /calendar/v3/calendars/{calendarId}/events/{eventId} (204; 404/410 = gone)
 *
 * Scope: ONLY `calendar.events.owned` ("view, create, change and delete events
 * on calendars you own", https://developers.google.com/calendar/api/auth) —
 * narrower than `calendar.events` (which reaches calendars shared with you)
 * and accepted by Events: insert. No openid/email/profile: the module never
 * learns who the Google account is.
 *
 * Nothing here logs. Errors carry a short code, never Google's message (it can
 * echo data) and never a token.
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
export const CALENDAR_API = "https://www.googleapis.com/calendar/v3"
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned"

export type GoogleOptions = {
  clientId: string
  clientSecret: string
  redirectUri: string
  fetch?: typeof fetch
}

export type TokenSet = {
  accessToken: string
  /** Only on the code exchange (with access_type=offline + prompt=consent). */
  refreshToken: string | null
  expiresIn: number
  /** Space-separated scopes Google actually granted (granular consent may drop some). */
  scope: string
}

export type TokenResult =
  | { ok: true; tokens: TokenSet }
  /** `revoked`: invalid_grant (revoked, expired or the user removed access). Everything else may be retried. */
  | { ok: false; revoked: boolean; code: string }

/** Retryable: network, 429, 5xx, rate limits. `unauthorized`: the access token is not accepted (refresh and retry once). `scope`: permission missing. `rejected`: 4xx that will not get better. */
export type CallErrorKind = "network" | "retryable" | "unauthorized" | "scope" | "rejected"
export type CallResult = { ok: true } | { ok: false; kind: CallErrorKind; code: string }

/** Event body for Calendar API v3 (times as RFC 3339 instants + the resource's IANA zone). */
export type EventBody = {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  status: "confirmed"
  /** Private to this OAuth client: lets a person (or a future import) tell Fulvia's events apart. */
  extendedProperties: { private: Record<string, string> }
}

export type GoogleClient = ReturnType<typeof googleClient>

export function hasCalendarScope(scope: string): boolean {
  return scope.split(/\s+/).includes(CALENDAR_SCOPE)
}

export function googleClient(opts: GoogleOptions) {
  const doFetch = opts.fetch ?? fetch

  async function tokenRequest(params: Record<string, string>): Promise<TokenResult> {
    let res: Response
    try {
      res = await doFetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ client_id: opts.clientId, client_secret: opts.clientSecret, ...params }),
      })
    } catch {
      return { ok: false, revoked: false, code: "network" }
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      const error = typeof body?.error === "string" ? body.error : `http_${res.status}`
      return { ok: false, revoked: error === "invalid_grant", code: error.slice(0, 40) }
    }
    const accessToken = body?.access_token
    const expiresIn = body?.expires_in
    if (typeof accessToken !== "string" || !accessToken || typeof expiresIn !== "number")
      return { ok: false, revoked: false, code: "bad_response" }
    return {
      ok: true,
      tokens: {
        accessToken,
        refreshToken: typeof body?.refresh_token === "string" && body.refresh_token ? body.refresh_token : null,
        expiresIn,
        scope: typeof body?.scope === "string" ? body.scope : "",
      },
    }
  }

  function classify(status: number, body: unknown): CallResult {
    const err = (body as { error?: { errors?: { reason?: unknown }[] } } | null)?.error
    const reason = typeof err?.errors?.[0]?.reason === "string" ? (err.errors[0].reason as string) : ""
    const code = (reason || `http_${status}`).slice(0, 40)
    if (status === 401) return { ok: false, kind: "unauthorized", code }
    if (status === 429 || status >= 500) return { ok: false, kind: "retryable", code }
    if (status === 403) {
      // usageLimits reasons (rateLimitExceeded, userRateLimitExceeded, quotaExceeded) are temporary;
      // any other 403 (insufficientPermissions, forbidden…) needs the person to reconnect.
      if (/rateLimit|quotaExceeded/i.test(reason)) return { ok: false, kind: "retryable", code }
      return { ok: false, kind: "scope", code }
    }
    return { ok: false, kind: "rejected", code }
  }

  async function call(method: string, url: string, token: string, body?: unknown): Promise<{ status: number; result: CallResult }> {
    let res: Response
    try {
      res = await doFetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      return { status: 0, result: { ok: false, kind: "network", code: "network" } }
    }
    const parsed = await res.json().catch(() => null)
    if (res.ok) return { status: res.status, result: { ok: true } }
    return { status: res.status, result: classify(res.status, parsed) }
  }

  const eventsUrl = (calendarId: string) => `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`

  return {
    /** The consent screen: offline access (refresh token), forced consent, PKCE S256, one scope. */
    authUrl(p: { state: string; codeChallenge: string }): string {
      const params = new URLSearchParams({
        client_id: opts.clientId,
        redirect_uri: opts.redirectUri,
        response_type: "code",
        scope: CALENDAR_SCOPE,
        state: p.state,
        access_type: "offline",
        // Without it Google returns a refresh token only on the first consent.
        prompt: "consent",
        code_challenge: p.codeChallenge,
        code_challenge_method: "S256",
      })
      return `${GOOGLE_AUTH_URL}?${params.toString()}`
    },

    exchangeCode(code: string, codeVerifier: string): Promise<TokenResult> {
      return tokenRequest({
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: opts.redirectUri,
      })
    },

    refresh(refreshToken: string): Promise<TokenResult> {
      return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
    },

    /** Best effort: true when Google confirmed (200) or the token was already invalid (400). */
    async revoke(token: string): Promise<boolean> {
      try {
        const res = await doFetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
        })
        return res.ok || res.status === 400
      } catch {
        return false
      }
    },

    /**
     * Create the event with OUR id; if it already exists (409: a retry, or a
     * previous sync), PATCH it. An event the person deleted in Google is
     * "cancelled" and still answers 409; the PATCH with status "confirmed"
     * brings it back, which is what the booking says.
     */
    async upsertEvent(token: string, calendarId: string, eventId: string, event: EventBody): Promise<CallResult> {
      const ins = await call("POST", `${eventsUrl(calendarId)}?sendUpdates=none`, token, { id: eventId, ...event })
      if (ins.result.ok || ins.status !== 409) return ins.result
      const upd = await call(
        "PATCH",
        `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=none`,
        token,
        event
      )
      return upd.result
    },

    /** Delete the event; 404 and 410 (already gone) count as done. */
    async deleteEvent(token: string, calendarId: string, eventId: string): Promise<CallResult> {
      const del = await call("DELETE", `${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}?sendUpdates=none`, token)
      if (!del.result.ok && (del.status === 404 || del.status === 410)) return { ok: true }
      return del.result
    },
  }
}
