"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ZodType } from "zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard"
import { ButtonLink } from "@/components/button-link"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "@/components/ui/toast"
import { describedBy } from "@/lib/forms"
import type { DomainCopy, FieldMeta, FormValues, Option } from "@/lib/domain/meta"
import type { FormResult } from "@/lib/schemas/auth"

const INPUT_TYPE: Partial<Record<FieldMeta["type"], string>> = {
  email: "email",
  phone: "tel",
  url: "url",
  image: "url",
  date: "date",
  datetime: "datetime-local",
}

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"

/**
 * One form for every entity: the fields come as data, the schema is the same
 * Zod schema the Server Action re-validates with, and the five a11y rules of
 * CONVENTIONS.md §2 are applied here once, so no entity can forget them.
 * Copied by AllFlow's genesis from `genesis/templates/components/domain/`.
 */
export function EntityForm({
  fields,
  relationOptions,
  schema,
  defaultValues,
  action,
  copy,
  cancelHref,
  idPrefix,
}: {
  fields: FieldMeta[]
  /** relation fields: the rows of the target entity, by field name. */
  relationOptions: Record<string, Option[]>
  schema: ZodType
  defaultValues: FormValues
  action: (values: FormValues) => Promise<FormResult<string>>
  copy: DomainCopy
  cancelHref: string
  /** Keeps DOM ids unique when two forms share a page. */
  idPrefix: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isDirty },
  } = useForm<FieldValues>({
    // zodResolver is typed per schema; here the schema is data.
    resolver: zodResolver(schema as never) as never,
    mode: "onBlur",
    defaultValues,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await action(values as FormValues)
      if (res.ok) {
        reset(values) // clean again, so the unsaved-changes guard lets us leave
        toast.add({ title: res.message ?? copy.saved, type: "success" })
        router.push(res.redirectTo ?? cancelHref)
        router.refresh()
        return
      }
      let first = true
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(field, { message: String(message) }, { shouldFocus: first })
        first = false
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <UnsavedChangesGuard dirty={isDirty && !isPending} />
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}
      <FieldGroup>
        {fields.map((f) => {
          const id = `${idPrefix}-${f.name}`
          const errorId = `${id}-error`
          const options = f.type === "relation" ? relationOptions[f.name] : f.options
          return (
            <Controller
              key={f.name}
              name={f.name}
              control={control}
              render={({ field, fieldState }) => {
                const invalid = fieldState.invalid
                const aria = {
                  "aria-invalid": invalid || undefined,
                  "aria-describedby": describedBy(invalid && errorId),
                } as const
                const error = invalid && <FieldError id={errorId}>{fieldState.error?.message}</FieldError>

                if (f.type === "boolean") {
                  return (
                    <Field orientation="horizontal" data-invalid={invalid || undefined}>
                      <Checkbox
                        id={id}
                        name={field.name}
                        checked={Boolean(field.value)}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        onBlur={field.onBlur}
                        disabled={isPending}
                        {...aria}
                      />
                      <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                      {error}
                    </Field>
                  )
                }
                if (f.type === "enum" || f.type === "relation") {
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                      <NativeSelect {...field} value={String(field.value ?? "")} id={id} className="w-full" disabled={isPending} {...aria}>
                        {(!f.required || !field.value) && <NativeSelectOption value="">{copy.select}</NativeSelectOption>}
                        {(options ?? []).map((o) => (
                          <NativeSelectOption key={o.value} value={o.value}>
                            {o.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      {error}
                    </Field>
                  )
                }
                if (f.type === "longtext") {
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                      <textarea {...field} value={String(field.value ?? "")} id={id} rows={4} className={TEXTAREA_CLASS} readOnly={isPending} {...aria} />
                      {error}
                    </Field>
                  )
                }
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                    <Input
                      {...field}
                      value={String(field.value ?? "")}
                      id={id}
                      type={INPUT_TYPE[f.type] ?? "text"}
                      inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
                      readOnly={isPending}
                      {...aria}
                    />
                    {error}
                  </Field>
                )
              }}
            />
          )
        })}
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={isPending} label={copy.save} pendingLabel={copy.saving} />
        <ButtonLink href={cancelHref} variant="outline">
          {copy.cancel}
        </ButtonLink>
        {isDirty && !isPending && <span className="text-sm text-muted-foreground">{copy.unsavedHint}</span>}
      </div>
    </form>
  )
}
