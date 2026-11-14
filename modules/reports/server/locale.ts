import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/modules/i18n/contracts"

/** The request's locale, as the i18n module resolves it (cookie → Accept-Language → es). */
export async function requestLocale(): Promise<Locale> {
  const locale = await getLocale()
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}
