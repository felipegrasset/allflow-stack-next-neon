"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { catalogSchemas, type CategoryFormValues } from "../contracts/input"
import { es } from "../messages"
import { createCategoryAction } from "../server/actions"
import { FormField } from "./fields"

const EMPTY: CategoryFormValues = { name: "", slug: "", description: "" }

export function CategoryForm() {
  const copy = useModuleCopy(es)
  const { categorySchema } = useMemo(() => catalogSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setSaved(null)
    startTransition(async () => {
      const res = await createCategoryAction(values)
      if (res.ok) {
        reset(EMPTY)
        setSaved(res.message ?? copy.actions.categoryCreated)
        router.refresh()
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(name as keyof CategoryFormValues, { message }, { shouldFocus: !focused })
        focused = true
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const text = (name: keyof CategoryFormValues, label: string, description?: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField
          id={`catalog-category-${name}`}
          label={label}
          description={description}
          fieldState={fieldState}
        >
          {(aria) => <Input {...field} {...aria} autoComplete="off" readOnly={isPending} />}
        </FormField>
      )}
    />
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={copy.categories.newTitle}>
      {errors.root?.serverError ? <FormAlert>{errors.root.serverError.message}</FormAlert> : null}
      {saved ? <FormAlert variant="success">{saved}</FormAlert> : null}
      <FieldGroup>
        {text("name", copy.fields.categoryName)}
        {text("slug", copy.fields.slug, copy.fields.slugHint)}
        {text("description", copy.fields.description)}
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={copy.actions.createCategory}
        pendingLabel={copy.actions.creating}
        variant="outline"
        className="self-start"
      />
    </form>
  )
}
