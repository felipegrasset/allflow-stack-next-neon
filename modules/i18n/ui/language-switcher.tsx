import { currentLocale } from "../server/locale"

import { LanguageSelector } from "./language-selector"

/** Server wrapper for pages with no AppShell (landing, sign-in): the selector, in the active locale. */
export async function LanguageSwitcher() {
  return <LanguageSelector current={await currentLocale()} />
}
