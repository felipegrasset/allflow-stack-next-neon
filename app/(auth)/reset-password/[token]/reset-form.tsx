"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { authCopy } from "@/lib/copy/auth"
import { describedBy } from "@/lib/forms"
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas/auth"
import { resetPasswordAction } from "../../actions"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const c = authCopy.reset
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: { token, password: "", confirm: "" },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await resetPasswordAction(values)
      if (res.ok) {
        toast.add({ title: authCopy.login.passwordChanged, type: "success" })
        router.replace(res.redirectTo ?? "/login")
        return
      }
      if (res.fieldErrors?.password) setError("password", { message: res.fieldErrors.password }, { shouldFocus: true })
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={c.title}>
      {errors.root?.serverError && (
        <FormAlert>
          {errors.root.serverError.message}{" "}
          <Link href="/forgot-password" className="underline underline-offset-4">
            {c.requestNew}
          </Link>
        </FormAlert>
      )}
      <FieldGroup>
        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="password">{c.newPassword}</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="new-password"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("password-description", fieldState.invalid && "password-error")}
              />
              <FieldDescription id="password-description">{authCopy.signup.passwordHelp}</FieldDescription>
              {fieldState.invalid && <FieldError id="password-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="confirm"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="confirm">{c.confirmPassword}</FieldLabel>
              <Input
                {...field}
                id="confirm"
                type="password"
                autoComplete="new-password"
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy(fieldState.invalid && "confirm-error")}
              />
              {fieldState.invalid && <FieldError id="confirm-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>
      <SubmitButton pending={isPending} label={c.submit} pendingLabel={c.submitting} className="w-full" />
    </form>
  )
}
