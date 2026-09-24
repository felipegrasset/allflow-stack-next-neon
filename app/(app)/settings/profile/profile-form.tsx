"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "@/components/ui/toast"
import { profileCopy } from "@/lib/copy/profile"
import { describedBy } from "@/lib/forms"
import { LOCALES, profileSchema, type ProfileInput } from "@/lib/schemas/profile"
import { updateProfileAction } from "../actions"

export function ProfileForm({ email, initial }: { email: string; initial: ProfileInput }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const c = profileCopy.profile
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    defaultValues: initial,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await updateProfileAction(values)
      if (res.ok) {
        reset(values) // clean again: the new values are the baseline
        toast.add({ title: c.saved, type: "success" })
        router.refresh() // the header shows the new name
        return
      }
      let first = true
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(field as keyof ProfileInput, { message }, { shouldFocus: first })
        first = false
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <Card>
      <UnsavedChangesGuard dirty={isDirty && !isPending} />
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
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="name">{c.nameLabel}</FieldLabel>
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
            <Field>
              <FieldLabel htmlFor="email">{c.emailLabel}</FieldLabel>
              <Input id="email" type="email" value={email} readOnly autoComplete="email" aria-describedby="email-description" />
              <FieldDescription id="email-description">{c.emailHelp}</FieldDescription>
            </Field>
            <Controller
              name="locale"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="locale">{c.localeLabel}</FieldLabel>
                  <NativeSelect
                    {...field}
                    id="locale"
                    className="w-full"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid || undefined}
                    aria-describedby={describedBy(fieldState.invalid && "locale-error")}
                  >
                    {LOCALES.map((l) => (
                      <NativeSelectOption key={l} value={l}>
                        {profileCopy.locales[l]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.invalid && <FieldError id="locale-error">{fieldState.error?.message}</FieldError>}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 flex items-center gap-3">
          <SubmitButton pending={isPending} label={profileCopy.common.save} pendingLabel={profileCopy.common.saving} />
          {isDirty && !isPending && (
            <span className="text-sm text-muted-foreground" data-testid="dirty-hint">
              {c.unsavedHint}
            </span>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
