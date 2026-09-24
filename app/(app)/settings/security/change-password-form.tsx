"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { profileCopy } from "@/lib/copy/profile"
import { describedBy } from "@/lib/forms"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/profile"
import { changePasswordAction } from "../actions"

const EMPTY: ChangePasswordInput = { currentPassword: "", newPassword: "", confirm: "", revokeOtherSessions: true }

export function ChangePasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const c = profileCopy.security
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await changePasswordAction(values)
      if (res.ok) {
        reset(EMPTY)
        toast.add({ title: res.message ?? c.changed, type: "success" })
        router.refresh() // session count
        return
      }
      if (res.fieldErrors?.currentPassword) {
        setError("currentPassword", { message: res.fieldErrors.currentPassword }, { shouldFocus: true })
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const password = (
    name: "currentPassword" | "newPassword" | "confirm",
    label: string,
    autoComplete: "current-password" | "new-password",
    help?: string
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            {...field}
            id={name}
            type="password"
            autoComplete={autoComplete}
            readOnly={isPending}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={describedBy(help && `${name}-description`, fieldState.invalid && `${name}-error`)}
          />
          {help && <FieldDescription id={`${name}-description`}>{help}</FieldDescription>}
          {fieldState.invalid && <FieldError id={`${name}-error`}>{fieldState.error?.message}</FieldError>}
        </Field>
      )}
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{c.title}</h2>
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate aria-label={c.title}>
        <CardContent className="flex flex-col gap-6">
          {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}
          <FieldGroup>
            {password("currentPassword", c.currentPassword, "current-password")}
            {password("newPassword", c.newPassword, "new-password", c.newPasswordHelp)}
            {password("confirm", c.confirmPassword, "new-password")}
            <Controller
              name="revokeOtherSessions"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="revokeOtherSessions"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    disabled={isPending}
                  />
                  <FieldLabel htmlFor="revokeOtherSessions" className="font-normal">
                    {c.revokeOthers}
                  </FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6">
          <SubmitButton pending={isPending} label={c.submit} pendingLabel={c.submitting} />
        </CardFooter>
      </form>
    </Card>
  )
}
