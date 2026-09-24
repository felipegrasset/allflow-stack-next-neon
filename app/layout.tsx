import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import "./tokens-contrast.css"
import { AppToaster } from "@/components/app-toaster"
import { ThemeScript } from "@/components/theme-provider"
import { ThemeSync } from "@/components/theme-sync"
import { authCopy } from "@/lib/copy/auth"
import { APP_TITLE, APP_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
import { faultsEnabled, throwIfFault } from "@/server/e2e-faults"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? APP_URL),
  title: { default: APP_TITLE, template: `%s · ${APP_TITLE}` },
  applicationName: APP_TITLE,
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Only with E2E_FAULTS=1: without it no cookie is read and static pages stay static.
  if (faultsEnabled()) await throwIfFault("layout-error")
  return (
    // suppressHydrationWarning: ThemeScript mutates <html class> before hydration.
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
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
        {children}
        {/* Without it toast.add() silently does nothing. */}
        <AppToaster />
        <ThemeSync />
      </body>
    </html>
  )
}
