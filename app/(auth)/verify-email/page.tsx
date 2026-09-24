import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authCopy } from "@/lib/copy/auth"
import { emailOnlySchema } from "@/lib/schemas/auth"
import { ResendVerificationForm } from "./resend-form"

export const metadata: Metadata = { title: authCopy.verifyEmail.title }

/**
 * "Check your email" — where sign-up lands (?email=…), and where the
 * verification callback sends you to ask for a new link (no email: the form
 * asks for it).
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email: raw } = await searchParams
  const parsed = emailOnlySchema.safeParse({ email: raw ?? "" })
  const email = parsed.success ? parsed.data.email : null
  const c = authCopy.verifyEmail

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{c.title}</h1>
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              {c.sentTo} <strong data-testid="verify-email-address">{email}</strong>. {c.openIt}
            </>
          ) : (
            c.askEmail
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {email && <p className="text-sm text-muted-foreground">{c.notArrived}</p>}
        <ResendVerificationForm initialEmail={email} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="underline underline-offset-4">
          {authCopy.common.backToLogin}
        </Link>
      </CardFooter>
    </Card>
  )
}
