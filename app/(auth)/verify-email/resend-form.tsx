"use client"

import { useEffect, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { emailOnlySchema, type EmailOnlyInput } from "@/lib/schemas/auth"
import { resendVerificationAction } from "../actions"

export const RESEND_COOLDOWN_S = 60

/**
 * Resend the verification email, with a 60 s cooldown and a visible counter.
 * With `initialEmail` (just signed up) the email was sent a moment ago, so the
 * cooldown starts running; without it the form asks for the email first. The
 * server enforces the same 60 s (server/rate-limit.ts).
 */
export function ResendVerificationForm({ initialEmail }: { initialEmail: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [remaining, setRemaining] = useState(initialEmail ? RESEND_COOLDOWN_S : 0)
  const c = authCopy.verifyEmail
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<EmailOnlyInput>({
    resolver: zodResolver(emailOnlySchema),
    mode: "onBlur",
    defaultValues: { email: initialEmail ?? "" },
  })

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await resendVerificationAction(values)
      if (res.ok) {
        toast.add({ title: c.resent, description: c.resentDescription, type: "success" })
        setRemaining(RESEND_COOLDOWN_S)
        return
      }
      if (res.retryAfter) setRemaining(res.retryAfter)
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const coolingDown = remaining > 0
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={c.resend}>
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}

      {!initialEmail && (
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
      )}

      <SubmitButton
        pending={isPending}
        disabled={coolingDown}
        variant="outline"
        className="w-full tabular-nums"
        label={coolingDown ? c.cooldown(remaining) : c.resend}
        pendingLabel={c.resending}
      />
    </form>
  )
}
