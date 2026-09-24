"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { loginSchema, type LoginInput } from "@/lib/schemas/auth"
import { loginAction } from "../actions"

export function LoginForm({ next }: { next: string }) {
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
      const res = await loginAction(values, next)
      if (res.ok) {
        router.replace(res.redirectTo ?? "/")
        router.refresh()
        return
      }
      if (res.fieldErrors?.email) setError("email", { message: res.fieldErrors.email }, { shouldFocus: true })
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={authCopy.login.title}>
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}

      <FieldGroup>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="email">{authCopy.common.email}</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy(fieldState.invalid && "email-error")}
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
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="password">{authCopy.common.password}</FieldLabel>
                <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">
                  {authCopy.login.forgot}
                </Link>
              </div>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy(fieldState.invalid && "password-error")}
              />
              {fieldState.invalid && <FieldError id="password-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>

      <SubmitButton
        pending={isPending}
        label={authCopy.login.submit}
        pendingLabel={authCopy.login.submitting}
        className="w-full"
      />
    </form>
  )
}
