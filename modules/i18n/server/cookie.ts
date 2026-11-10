import { cookies } from "next/headers"

import { LOCALE_COOKIE, type Locale } from "../contracts"

const ONE_YEAR = 60 * 60 * 24 * 365

/** Remembers the visitor's language. Called by the selector and by the forms that save `user.locale`. */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  ;(await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  })
}
