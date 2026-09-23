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
