import Link from "next/link"
import { headers } from "next/headers"

import { logoutAction } from "./actions"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { APP_TITLE } from "@/lib/site"
import { auth } from "@/server/auth"
import { DEFAULT_ORG_SLUG } from "@/server/auth/bootstrap"
import { sql } from "@/lib/db"

/** The app shell's home (T1). T2 replaces it with the real dashboard. */
export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  // App data goes through `sql` (Neon HTTP driver in production).
  const role = session
    ? (
        await sql<{ role: string }>`
          select m.role
          from member m
          join organization o on o.id = m."organizationId"
          where o.slug = ${DEFAULT_ORG_SLUG} and m."userId" = ${session.user.id}
          limit 1`
      )[0]?.role
    : undefined

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm font-medium">{APP_TITLE}</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session && (
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </form>
          )}
        </div>
      </header>
      <main id="contenido" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">{APP_TITLE}</h1>
        {session ? (
          <div className="flex flex-col gap-1 text-sm">
            <p data-testid="session-email">
              Sesión iniciada como <strong>{session.user.email}</strong>
            </p>
            {role && <p data-testid="session-role">Rol: {role}</p>}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button render={<Link href="/login" />} nativeButton={false}>
              Iniciar sesión
            </Button>
            <Button variant="outline" render={<Link href="/signup" />} nativeButton={false}>
              Crear cuenta
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
