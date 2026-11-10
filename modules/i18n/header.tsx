import { LanguageSwitcher } from "./ui/language-switcher"

/** Header slot (contract): the language selector, before the theme toggle. */
export default async function I18nHeader() {
  return <LanguageSwitcher />
}
