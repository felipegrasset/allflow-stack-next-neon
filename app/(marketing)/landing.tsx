import { BrandMark } from "@/components/brand-mark"
import { ButtonLink } from "@/components/button-link"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_TITLE } from "@/lib/site"
import { LanguageSwitcher } from "@/modules/i18n/ui/language-switcher"
import { getCopy } from "@/modules/i18n/server/copy"

/**
 * The public landing (signed out). Rendered by app/page.tsx — a route group
 * can't own "/" next to the signed-in home, so the page there only decides
 * which of the two to show. The genesis replaces this file with the app's
 * headline, value proposition and bullets.
 */
export async function Landing() {
  const authCopy = await getCopy("auth")
  const c = authCopy.shell
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <BrandMark className="text-sm font-medium" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main
        id="contenido"
        className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <h1 className="text-2xl font-semibold">{APP_TITLE}</h1>
        <p className="text-sm text-muted-foreground">{c.guestDescription}</p>
        <div className="flex gap-2">
          <ButtonLink href="/login">{authCopy.login.title}</ButtonLink>
          <ButtonLink href="/signup" variant="outline">
            {authCopy.signup.title}
          </ButtonLink>
        </div>
      </main>
    </div>
  )
}
