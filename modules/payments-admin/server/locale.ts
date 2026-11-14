import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/modules/i18n/contracts"

/** The active locale, narrowed to the ones the formatters of i18n take. */
export async function currentLocale(): Promise<Locale> {
  const l = await getLocale()
  return isLocale(l) ? l : DEFAULT_LOCALE
}
