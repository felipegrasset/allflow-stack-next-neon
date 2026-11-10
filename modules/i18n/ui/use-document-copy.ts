"use client"

/**
 * For the one place that renders with no provider: `app/global-error.tsx`
 * (it replaces the root layout, so `NextIntlClientProvider` is gone). It
 * reads the locale from the cookie in the browser and falls back to the
 * default on the server pass.
 */
import { useMemo, useSyncExternalStore } from "react"

import { sourceCopy, type Namespace, type NamespaceCopy } from "../copy"
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "../contracts"
import { messages } from "../messages"

function readCookieLocale(): Locale {
  try {
    const hit = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    const value = hit?.slice(LOCALE_COOKIE.length + 1)
    return isLocale(value) ? value : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

const noSubscribe = () => () => {}

export function useDocumentCopy<N extends Namespace>(
  namespace: N
): { copy: NamespaceCopy<N>; locale: Locale } {
  const locale = useSyncExternalStore(
    noSubscribe,
    readCookieLocale,
    () => DEFAULT_LOCALE
  )
  const copy = useMemo(
    () => sourceCopy(namespace, messages[locale]),
    [namespace, locale]
  )
  return { copy, locale }
}
