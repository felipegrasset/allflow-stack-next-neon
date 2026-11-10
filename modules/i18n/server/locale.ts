import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, type Locale } from "../contracts"

/** The locale of the current request (the same one `<html lang>` carries). */
export async function currentLocale(): Promise<Locale> {
  const locale = await getLocale()
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}
