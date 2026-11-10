/**
 * next-intl's per-request config (registered in next.config.ts through
 * `createNextIntlPlugin`). The locale is, in order: the `NEXT_LOCALE` cookie
 * (set by the language selector and by the profile / onboarding forms), the
 * browser's `Accept-Language`, `DEFAULT_LOCALE`.
 */
import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
} from "./contracts"
import { messages } from "./messages"

export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(fromCookie)
    ? fromCookie
    : (negotiateLocale((await headers()).get("accept-language")) ??
      DEFAULT_LOCALE)
  return { locale, messages: messages[locale] }
})
