/**
 * Which copy set a visitor sees. Same order as the i18n module's request
 * config (modules/i18n/request.ts) so the landing and `<html lang>` agree:
 * the `NEXT_LOCALE` cookie the language selector writes, then the browser's
 * Accept-Language, then — instead of i18n's global default — the `locale`
 * declared in `landing.json` (the app's source language).
 *
 * Pure on purpose (no `next/headers`): the page passes the raw values in, and
 * the tests call it directly. Imports only the i18n module's `contracts`.
 */
import {
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
} from "@/modules/i18n/contracts"

import type { LandingDoc } from "./contracts"

export type LandingLocale = LandingDoc["locale"]

/** The locales `copy.ts` and every template ship (the `locale` enum of `landing.json`). */
export const LANDING_LOCALES = ["es", "en"] as const satisfies readonly LandingLocale[]

const supported = (value: unknown): value is LandingLocale =>
  isLocale(value) && (LANDING_LOCALES as readonly string[]).includes(value)

export function pickLandingLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null | undefined,
  fallback: LandingLocale
): LandingLocale {
  if (supported(cookie)) return cookie
  const negotiated = negotiateLocale(acceptLanguage)
  return supported(negotiated) ? negotiated : fallback
}

export { LOCALE_COOKIE }
