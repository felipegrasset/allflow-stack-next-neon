import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/modules/i18n/contracts"

/** The request's locale; the default outside a request (a script, a job). */
export async function currentLocale(): Promise<Locale> {
  try {
    const l = await getLocale()
    return isLocale(l) ? l : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}
