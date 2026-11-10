/**
 * The i18n module's public face: the only file other modules may import.
 * Pure (no server or client APIs), so a server component, a client component
 * and a Zod schema can all use it.
 */

/** The locales the app ships. The genesis also generates `pt`; it is out of the MVP (see MODULE.md). */
export const LOCALES = ["es", "en"] as const
export type Locale = (typeof LOCALES)[number]

/** The locale of a visitor with no cookie and no matching Accept-Language. */
export const DEFAULT_LOCALE: Locale = "es"

/** Where the chosen locale lives (a plain cookie: the choice must survive sign-out). */
export const LOCALE_COOKIE = "NEXT_LOCALE"

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  )
}

/**
 * BCP 47 tag handed to `Intl` for each locale. `es` formats as Chilean Spanish
 * (the first market), `en` as US English; change a value here to change every
 * date, number and currency of the app.
 */
export const INTL_TAG: Record<Locale, string> = { es: "es-CL", en: "en-US" }

export type DateInput = Date | string | number

const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d))

/** `formatDate(d, "es")` → "10-11-2026"; `style` is Intl's `dateStyle`. */
export function formatDate(
  value: DateInput,
  locale: Locale,
  style: "short" | "medium" | "long" = "medium",
  timeZone?: string
): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: style,
    timeZone,
  }).format(toDate(value))
}

export function formatDateTime(
  value: DateInput,
  locale: Locale,
  timeZone?: string
): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(toDate(value))
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_TAG[locale], options).format(value)
}

/**
 * `formatCurrency(1990, "CLP", "es")` → "$1.990". `currency` is an ISO 4217
 * code; the amount is the major unit (no cents arithmetic here: money logic
 * lives in the payments module).
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale: Locale
): string {
  return new Intl.NumberFormat(INTL_TAG[locale], {
    style: "currency",
    currency,
  }).format(value)
}

/** `formatRelative(-3, "day", "en")` → "3 days ago". */
export function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale
): string {
  return new Intl.RelativeTimeFormat(INTL_TAG[locale], {
    numeric: "auto",
  }).format(value, unit)
}

/** Picks the best supported locale from an `Accept-Language` header, or null. */
export function negotiateLocale(
  acceptLanguage: string | null | undefined
): Locale | null {
  if (!acceptLanguage) return null
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      return {
        base: tag.trim().toLowerCase().split("-")[0],
        q: q ? Number(q.slice(2)) : 1,
      }
    })
    .filter((x) => x.base && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { base } of ranked) if (isLocale(base)) return base
  return null
}
