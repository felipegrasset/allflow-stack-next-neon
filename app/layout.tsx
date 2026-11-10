import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"

import { body, heading, mono } from "./fonts"
import "./globals.css"
import "./tokens-contrast.css"
import { AppToaster } from "@/components/app-toaster"
import { ThemeScript } from "@/components/theme-provider"
import { ThemeSync } from "@/components/theme-sync"
import { APP_TITLE, publicUrl } from "@/lib/site"
import { cn } from "@/lib/utils"
import { getCopy } from "@/modules/i18n/server/copy"
import { currentLocale } from "@/modules/i18n/server/locale"
import { faultsEnabled, throwIfFault } from "@/server/e2e-faults"

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl()),
  title: { default: APP_TITLE, template: `%s · ${APP_TITLE}` },
  applicationName: APP_TITLE,
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Only with E2E_FAULTS=1: without it no cookie is read and static pages stay static.
  if (faultsEnabled()) await throwIfFault("layout-error")
  const locale = await currentLocale()
  const authCopy = await getCopy("auth")
  return (
    // suppressHydrationWarning: ThemeScript mutates <html class> before hydration.
    <html
      lang={locale}
      suppressHydrationWarning
      data-default-theme="system"
      className={cn("antialiased", mono.variable, "font-sans", body.variable, heading.variable)}
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          {authCopy.shell.skipLink}
        </a>
        {/* Messages for client components (useCopy). Inherits locale and catalog from modules/i18n/request.ts. */}
        <NextIntlClientProvider>
          {children}
          {/* Without it toast.add() silently does nothing. */}
          <AppToaster />
        </NextIntlClientProvider>
        <ThemeSync />
      </body>
    </html>
  )
}
