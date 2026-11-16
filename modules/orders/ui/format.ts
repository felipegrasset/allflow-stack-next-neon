import { DEFAULT_LOCALE, formatCurrency, isLocale, type Locale } from "@/modules/i18n/contracts"
import { minorToMajor } from "@/modules/catalog/contracts/money"

export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Minor units + currency → "$1.990" / "US$15.50", in the active locale. Display only. */
export function formatMoney(amountMinor: number, currency: string, locale: Locale): string {
  return formatCurrency(minorToMajor(amountMinor, currency), currency, locale)
}

/** First value of a search param. */
export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)
