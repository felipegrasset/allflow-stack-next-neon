"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { loginSchema, type LoginInput } from "@/lib/schemas/auth"
import { loginAction } from "../actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

/** Minimal login (T1) — T2 replaces it with the registry's auth kit. */
export function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await loginAction(values)
      if (res.ok) {
        router.replace(res.redirectTo)
        router.refresh()
        return
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root?.serverError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errors.root.serverError.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                disabled={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={fieldState.invalid ? "email-error" : undefined}
              />
              {fieldState.invalid && <FieldError id="email-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={fieldState.invalid ? "password-error" : undefined}
              />
              {fieldState.invalid && (
                <FieldError id="password-error">{fieldState.error?.message}</FieldError>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" disabled={isPending} aria-busy={isPending} className="w-full">
        {isPending && <Spinner />}
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  )
}
