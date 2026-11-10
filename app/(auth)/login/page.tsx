import type { Metadata } from "next"
import Link from "next/link"

import { FormAlert } from "@/components/form-alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { safeNext } from "@/lib/schemas/auth"
import { LoginPanel } from "./login-panel"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const authCopy = await getCopy("auth")
  return { title: authCopy.login.title }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>
}) {
  const authCopy = await getCopy("auth")
  const { next, reset } = await searchParams
  const c = authCopy.login
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{c.title}</h1>
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {reset === "ok" && <FormAlert variant="success">{c.passwordChanged}</FormAlert>}
        <LoginPanel next={safeNext(next)} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span>
          {c.noAccount}{" "}
          <Link href="/signup" className="underline underline-offset-4">
            {c.signupLink}
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
