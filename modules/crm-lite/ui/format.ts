import {
  DEFAULT_LOCALE,
  formatCurrency,
  isLocale,
  type Locale,
} from "@/modules/i18n/contracts"

import { minorToMajor } from "../contracts/money"

export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Minor units + currency → "$1.500.000" / "US$15.50", in the active locale. */
export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: Locale
): string {
  return formatCurrency(minorToMajor(amountMinor, currency), currency, locale)
}

/** Sum per currency (a column can mix currencies; they are never added together). */
export function totalsByCurrency(
  items: { amountMinor: number; currency: string }[],
  locale: Locale
): string {
  const sums = new Map<string, number>()
  for (const d of items)
    sums.set(d.currency, (sums.get(d.currency) ?? 0) + d.amountMinor)
  return [...sums.entries()]
    .map(([currency, minor]) => formatMoney(minor, currency, locale))
    .join(" · ")
}
