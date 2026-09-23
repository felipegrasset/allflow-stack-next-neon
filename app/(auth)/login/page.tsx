import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">Iniciar sesión</h1>
        </CardTitle>
        <CardDescription>Entra con tu correo y contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span>
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Crear una
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
