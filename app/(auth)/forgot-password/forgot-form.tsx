"use client"

import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { emailOnlySchema, type EmailOnlyInput } from "@/lib/schemas/auth"
import { forgotPasswordAction } from "../actions"

/** Success is the SAME message for every email: it never reveals whether an account exists. */
export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<EmailOnlyInput>({
    resolver: zodResolver(emailOnlySchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await forgotPasswordAction(values)
      if (res.ok) return setSent(res.message ?? authCopy.forgot.sent)
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  if (sent) {
    return (
      <FormAlert variant="success" title={authCopy.forgot.sentTitle}>
        {sent}
      </FormAlert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={authCopy.forgot.title}>
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
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={authCopy.forgot.submit}
        pendingLabel={authCopy.forgot.submitting}
        className="w-full"
      />
    </form>
  )
}
