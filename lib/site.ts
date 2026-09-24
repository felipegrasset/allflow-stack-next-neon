/**
 * The app's identity, in ONE place. Forge (AllFlow's generator) replaces the
 * literals below when it turns this template into a client's app — the list of
 * files where they may appear is `allflow.sentinels.json`. Everything else
 * (metadata, emails, the default organization) imports from here instead of
 * repeating the literals.
 */

/** Slug: npm name, default organization slug. */
export const APP_NAME = "allflow-sentinel-app-name"

/** Human-visible name. */
export const APP_TITLE = "Allflow Sentinel App"

/** Canonical public URL. `BETTER_AUTH_URL` overrides it at runtime. */
export const APP_URL = "https://allflow-sentinel-domain.example"

/**
 * The URL the app is actually served from — what auth redirects, email links
 * and metadata use. In order:
 *
 *   1. `BETTER_AUTH_URL`, if someone set it (a custom domain).
 *   2. On Vercel production, `VERCEL_PROJECT_PRODUCTION_URL` — the domain
 *      Vercel really assigned. AllFlow can't know it in advance: when
 *      `<name>.vercel.app` is taken, Vercel picks another.
 *   3. On a Vercel preview, that deployment's own URL.
 *   4. `APP_URL` (local, CI).
 */
export function publicUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return APP_URL
}

/**
 * Every host a request may legitimately come from on Vercel: the production
 * domain, the deployment URL and the branch alias. Better Auth rejects
 * requests whose origin isn't trusted, and a preview is reachable by more
 * than one of these.
 */
export function vercelOrigins(): string[] {
  return [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .filter((h): h is string => Boolean(h))
    .map((h) => `https://${h}`)
}
