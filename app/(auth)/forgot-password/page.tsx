import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authCopy } from "@/lib/copy/auth"
import { ForgotPasswordForm } from "./forgot-form"

export const metadata: Metadata = { title: authCopy.forgot.title }

export default function ForgotPasswordPage() {
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
