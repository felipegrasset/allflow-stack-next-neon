import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authCopy } from "@/lib/copy/auth"
import { SignUpForm } from "./signup-form"

export const metadata: Metadata = { title: authCopy.signup.title }

export default function SignUpPage() {
  const c = authCopy.signup
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{c.title}</h1>
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span>
          {c.haveAccount}{" "}
          <Link href="/login" className="underline underline-offset-4">
            {c.loginLink}
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
