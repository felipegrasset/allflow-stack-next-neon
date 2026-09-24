import type { Metadata } from "next"
import { CircleAlertIcon } from "lucide-react"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authCopy } from "@/lib/copy/auth"
import { sql } from "@/lib/db"
import { ResetPasswordForm } from "./reset-form"

export const metadata: Metadata = { title: authCopy.reset.title }

/**
 * The token is checked BEFORE showing the form (loading.tsx covers the wait):
 * an expired link gets its error and a CTA up front, not after typing two
 * passwords. Same lookup Better Auth does — "reset-password:<token>" in the
 * verification table; resetPassword() re-checks and consumes it.
 */
async function tokenIsValid(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return false
  const rows = await sql<{ ok: boolean }>`
    select true as ok from verification
    where identifier = ${`reset-password:${token}`} and "expiresAt" > now()
    limit 1`
  return rows.length > 0
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = authCopy.reset

  if (!(await tokenIsValid(token))) {
    return (
      <StatusScreen
        withMain={false}
        title={c.invalidTitle}
        description={c.invalidDescription}
        icon={<CircleAlertIcon className="size-10 text-destructive" aria-hidden />}
      >
        <ButtonLink href="/forgot-password">
          {c.requestNew}
        </ButtonLink>
      </StatusScreen>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{c.title}</h1>
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  )
}
