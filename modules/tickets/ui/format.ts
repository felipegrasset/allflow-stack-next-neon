import { DEFAULT_LOCALE, isLocale, type Locale } from "@/modules/i18n/contracts"

export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}
