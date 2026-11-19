import { getLocale } from "next-intl/server"

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/modules/i18n/contracts"

export async function activeLocale(): Promise<Locale> {
  const l = await getLocale()
  return isLocale(l) ? l : DEFAULT_LOCALE
}
