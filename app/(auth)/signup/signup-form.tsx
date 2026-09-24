"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"
import { signUpAction } from "../actions"

/**
 * The reference form of CONVENTIONS.md §"Formularios": Field + Controller, one
 * Zod schema on both sides, the five a11y rules, server errors via setError.
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
        router.push(res.redirectTo ?? "/verify-email")
        return
      }
      // Server error on a field: mounted on the field, with focus (rule 4).
      if (res.fieldErrors?.email) setError("email", { message: res.fieldErrors.email }, { shouldFocus: true })
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const c = authCopy
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={c.signup.title}>
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}

      <FieldGroup>
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="name">{c.common.name}</FieldLabel>
              <Input
                {...field}
                id="name"
                autoComplete="name"
                readOnly={isPending}
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
              <FieldLabel htmlFor="email">{c.common.email}</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("email-description", fieldState.invalid && "email-error")}
              />
              <FieldDescription id="email-description">{c.signup.emailHelp}</FieldDescription>
              {fieldState.invalid && <FieldError id="email-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="password">{c.common.password}</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="new-password"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("password-description", fieldState.invalid && "password-error")}
              />
              <FieldDescription id="password-description">{c.signup.passwordHelp}</FieldDescription>
              {fieldState.invalid && <FieldError id="password-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>

      <SubmitButton pending={isPending} label={c.signup.submit} pendingLabel={c.signup.submitting} className="w-full" />
    </form>
  )
}
