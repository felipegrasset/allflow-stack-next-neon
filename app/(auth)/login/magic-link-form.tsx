"use client"

import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { emailOnlySchema, type EmailOnlyInput } from "@/lib/schemas/auth"
import { magicLinkAction } from "../actions"

/** Sign in with a one-time link by email (Better Auth magicLink plugin). */
export function MagicLinkForm({ next }: { next: string }) {
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
    setSent(null)
    startTransition(async () => {
      const res = await magicLinkAction(values, next)
      if (res.ok) {
        setSent(res.message ?? null)
        return
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={authCopy.magicLink.title}>
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}
      {sent && <FormAlert variant="success">{sent}</FormAlert>}

      <FieldGroup>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="magic-email">{authCopy.common.email}</FieldLabel>
              <Input
                {...field}
                id="magic-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("magic-email-description", fieldState.invalid && "magic-email-error")}
              />
              <FieldDescription id="magic-email-description">{authCopy.magicLink.description}</FieldDescription>
              {fieldState.invalid && <FieldError id="magic-email-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>

      <SubmitButton
        pending={isPending}
        label={authCopy.magicLink.submit}
        pendingLabel={authCopy.magicLink.submitting}
        className="w-full"
      />
    </form>
  )
}
