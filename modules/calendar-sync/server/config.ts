/**
 * Configuration from the environment. Pure (env and base URL injected).
 *
 * The OAuth `redirect_uri` is FIXED: the app's public URL (lib/site.ts
 * `publicUrl()`, i.e. BETTER_AUTH_URL first) + CALLBACK_PATH. It never comes
 * from the request (Host / X-Forwarded-Host can be forged), and it must be
 * registered as is in Google Cloud Console.
 */
import { CalendarKeyError, deriveKeys, parseMasterKey, type DerivedKeys } from "./crypto"
import { CALLBACK_PATH, SETTINGS_PATH } from "./paths"

export type Env = Record<string, string | undefined>

export const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CALENDAR_SYNC_KEY"] as const

export type CalendarConfig =
  | {
      ok: true
      clientId: string
      clientSecret: string
      keys: DerivedKeys
      /** Absolute, derived from the app URL. */
      redirectUri: string
      /** Absolute URL of /settings/calendar (where the callback returns). */
      settingsUrl: string
    }
  | {
      ok: false
      /** Names (never values) of the variables missing or invalid. */
      missing: string[]
      /** CALENDAR_SYNC_KEY is set but is not 64 hex characters. */
      keyInvalid: boolean
      settingsUrl: string | null
    }

const val = (env: Env, k: string) => env[k]?.trim() || undefined

/** `https://…`, or `http://localhost…` in development. Anything else → null. */
export function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null
  return u.origin
}

export function readConfig(env: Env, baseUrl: string | undefined): CalendarConfig {
  const base = normalizeBaseUrl(baseUrl)
  const settingsUrl = base ? `${base}${SETTINGS_PATH}` : null
  const missing: string[] = ENV_KEYS.filter((k) => !val(env, k))
  let keys: DerivedKeys | null = null
  let keyInvalid = false
  const rawKey = val(env, "CALENDAR_SYNC_KEY")
  if (rawKey) {
    try {
      keys = deriveKeys(parseMasterKey(rawKey))
    } catch (e) {
      if (!(e instanceof CalendarKeyError)) throw e
      keyInvalid = true
      missing.push("CALENDAR_SYNC_KEY")
    }
  }
  if (!base) missing.push("BETTER_AUTH_URL")
  if (missing.length > 0 || !keys || !base || !settingsUrl)
    return { ok: false, missing, keyInvalid, settingsUrl }
  return {
    ok: true,
    clientId: val(env, "GOOGLE_CLIENT_ID")!,
    clientSecret: val(env, "GOOGLE_CLIENT_SECRET")!,
    keys,
    redirectUri: `${base}${CALLBACK_PATH}`,
    settingsUrl,
  }
}
