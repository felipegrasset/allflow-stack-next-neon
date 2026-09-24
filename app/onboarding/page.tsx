import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
import { profileCopy } from "@/lib/copy/profile"
import { LOCALES, type Locale } from "@/lib/schemas/profile"
import { APP_TITLE } from "@/lib/site"
import { requireUser } from "@/server/session"
import { OnboardingWizard } from "./onboarding-wizard"

export const metadata: Metadata = { title: profileCopy.onboarding.metaTitle }

/** The onboarding gate's destination: every signed-in user without "onboardedAt" lands here. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ paso?: string }> }) {
  const { user } = await requireUser("/onboarding")
  const initialStep = Math.max(0, (Number((await searchParams).paso) || 1) - 1)
  if (user.onboardedAt) redirect("/")
  const locale = (LOCALES as readonly string[]).includes(user.locale ?? "") ? (user.locale as Locale) : "es"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm font-medium">{APP_TITLE}</span>
        <ThemeToggle />
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center p-6 sm:items-center">
        <div className="w-full max-w-md">
          <OnboardingWizard initial={{ name: user.name, locale }} initialStep={initialStep} />
        </div>
      </main>
    </div>
  )
}
