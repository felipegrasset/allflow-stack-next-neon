"use client"

import { authCopy } from "@/lib/copy/auth"
import { APP_TITLE } from "@/lib/site"
import "./globals.css"

/**
 * When the ROOT LAYOUT itself fails. It replaces the whole document, so it
 * brings its own <html>/<body>, the stylesheet, and a copy of the theme script
 * (the app's ThemeScript lives in the layout that just failed). No metadata
 * export here: client component — the <title> tag does it.
 */
const THEME = `try{document.documentElement.classList.toggle("dark",localStorage.theme==="dark"||(localStorage.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))}catch(e){}`

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <title>{`${authCopy.globalError.title} · ${APP_TITLE}`}</title>
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <main id="contenido" className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">{authCopy.globalError.title}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{authCopy.globalError.description}</p>
          {error.digest && <p className="font-mono text-xs text-muted-foreground">{authCopy.error.code(error.digest)}</p>}
          {/* Plain elements: the UI kit may be what failed to load. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {authCopy.common.retry}
            </button>
            {/* A full reload on purpose: the root layout is what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {authCopy.common.backHome}
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
