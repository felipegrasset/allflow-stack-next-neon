import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "./forgot-form"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const authCopy = await getCopy("auth")
  return { title: authCopy.forgot.title }
}

export default async function ForgotPasswordPage() {
  const authCopy = await getCopy("auth")
  const c = authCopy.forgot
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{c.title}</h1>
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="underline underline-offset-4">
          {authCopy.common.backToLogin}
        </Link>
      </CardFooter>
    </Card>
  )
}
