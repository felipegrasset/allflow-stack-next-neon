import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SignUpForm } from "./signup-form"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">Crear cuenta</h1>
        </CardTitle>
        <CardDescription>Regístrate con tu correo.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Inicia sesión
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
