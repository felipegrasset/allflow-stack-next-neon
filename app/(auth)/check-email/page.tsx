import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Revisa tu correo" }

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">Revisa tu correo</h1>
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              Te enviamos un enlace de confirmación a <strong>{email}</strong>.
            </>
          ) : (
            "Te enviamos un enlace de confirmación."
          )}{" "}
          Ábrelo para activar tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      </CardFooter>
    </Card>
  )
}
