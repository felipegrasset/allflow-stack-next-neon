"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"
import { signUpAction } from "../actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

const describedBy = (...ids: (string | false | null | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined

/**
 * Minimal sign-up (T1) — T2 replaces it with the registry's auth kit. It
 * already follows the form pattern of CONVENTIONS.md: Field + Controller,
 * one Zod schema on both sides, the five a11y rules.
 */
export function SignUpForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", password: "" },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await signUpAction(values)
      if (res.ok) {
        router.push(res.redirectTo)
        return
      }
      if (res.fieldErrors?.email) {
        setError("email", { message: res.fieldErrors.email }, { shouldFocus: true })
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
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input
                {...field}
                id="name"
                autoComplete="name"
                disabled={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy(fieldState.invalid && "name-error")}
              />
              {fieldState.invalid && <FieldError id="name-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />

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
                aria-describedby={describedBy("email-description", fieldState.invalid && "email-error")}
              />
              <FieldDescription id="email-description">
                Te enviaremos un enlace para confirmarlo.
              </FieldDescription>
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
                autoComplete="new-password"
                disabled={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("password-description", fieldState.invalid && "password-error")}
              />
              <FieldDescription id="password-description">Mínimo 8 caracteres.</FieldDescription>
              {fieldState.invalid && (
                <FieldError id="password-error">{fieldState.error?.message}</FieldError>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" disabled={isPending} aria-busy={isPending} className="w-full">
        {isPending && <Spinner />}
        {isPending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  )
}
