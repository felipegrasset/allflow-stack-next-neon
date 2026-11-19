"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { formatAttributeLines } from "../contracts/domain"
import { catalogSchemas, type ItemFormValues } from "../contracts/input"
import { formatAmountInput } from "../contracts/money"
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  ITEM_STATUSES,
  type Category,
  type Currency,
  type Item,
} from "../contracts/types"
import { es } from "../messages"
import { createItemAction, updateItemAction } from "../server/actions"
import { FormField, TEXTAREA_CLASS } from "./fields"

const isCurrency = (c: string): c is Currency => (CURRENCIES as readonly string[]).includes(c)

/** Create (no `item`) or edit a product. */
export function ItemForm({ item, categories }: { item?: Item; categories: Category[] }) {
  const copy = useModuleCopy(es)
  const { itemSchema } = useMemo(() => catalogSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)
  const prefix = item ? "catalog-item-edit" : "catalog-item-new"
  const currency = item && isCurrency(item.currency) ? item.currency : DEFAULT_CURRENCY
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    mode: "onBlur",
    defaultValues: {
      name: item?.name ?? "",
      slug: item?.slug ?? "",
      description: item?.description ?? "",
      price: item ? formatAmountInput(item.priceMinor, item.currency) : "",
      currency,
      categoryId: item?.categoryId ?? "",
      status: item?.status ?? "draft",
      trackStock: item?.trackStock ?? true,
      sku: item?.sku ?? "",
      attributes: item ? formatAttributeLines(item.attributes) : "",
      initialStock: "",
    },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setSaved(null)
    startTransition(async () => {
      const res = item ? await updateItemAction(item.id, values) : await createItemAction(values)
      if (res.ok) {
        if (res.redirectTo) router.push(res.redirectTo)
        else {
          reset(values)
          setSaved(res.message ?? copy.actions.saved)
          router.refresh()
        }
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(name as keyof ItemFormValues, { message }, { shouldFocus: !focused })
        focused = true
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const text = (
    name: "name" | "slug" | "sku" | "price" | "initialStock",
    label: string,
    extra: React.ComponentProps<"input"> = {},
    description?: string
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField
          id={`${prefix}-${name}`}
          label={label}
          description={description}
          fieldState={fieldState}
        >
          {(aria) => <Input {...field} {...aria} {...extra} readOnly={isPending} />}
        </FormField>
      )}
    />
  )

  const area = (name: "description" | "attributes", label: string, rows: number, description?: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField id={`${prefix}-${name}`} label={label} description={description} fieldState={fieldState}>
          {(aria) => (
            <textarea {...field} {...aria} rows={rows} readOnly={isPending} className={TEXTAREA_CLASS} />
          )}
        </FormField>
      )}
    />
  )

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={item ? copy.item.editTitle : copy.admin.newTitle}
    >
      {errors.root?.serverError ? <FormAlert>{errors.root.serverError.message}</FormAlert> : null}
      {saved ? <FormAlert variant="success">{saved}</FormAlert> : null}
      <FieldGroup>
        {text("name", copy.fields.name, { autoComplete: "off" })}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          {text("price", copy.fields.price, { inputMode: "decimal", autoComplete: "off" })}
          <Controller
            name="currency"
            control={control}
            render={({ field, fieldState }) => (
              <FormField id={`${prefix}-currency`} label={copy.fields.currency} fieldState={fieldState}>
                {(aria) => (
                  <NativeSelect {...field} {...aria} disabled={isPending}>
                    {CURRENCIES.map((c) => (
                      <NativeSelectOption key={c} value={c}>
                        {c}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
          />
        </div>
        <Controller
          name="categoryId"
          control={control}
          render={({ field, fieldState }) => (
            <FormField id={`${prefix}-category`} label={copy.fields.category} fieldState={fieldState}>
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  <NativeSelectOption value="">{copy.fields.noCategory}</NativeSelectOption>
                  {categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id={`${prefix}-status`}
              label={copy.fields.status}
              description={copy.fields.statusHint}
              fieldState={fieldState}
            >
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  {ITEM_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {copy.statuses[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        />
        <Controller
          name="trackStock"
          control={control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id={`${prefix}-track`}
                name={field.name}
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                disabled={isPending}
                aria-describedby={`${prefix}-track-description`}
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={`${prefix}-track`}>{copy.fields.trackStock}</FieldLabel>
                <FieldDescription id={`${prefix}-track-description`}>
                  {copy.fields.trackStockHint}
                </FieldDescription>
              </div>
            </Field>
          )}
        />
        {item ? null : text("initialStock", copy.fields.initialStock, { inputMode: "numeric", autoComplete: "off" }, copy.fields.initialStockHint)}
        {text("sku", copy.fields.sku, { autoComplete: "off" })}
        {text("slug", copy.fields.slug, { autoComplete: "off" }, copy.fields.slugHint)}
        {area("description", copy.fields.description, 4)}
        {area("attributes", copy.fields.attributes, 4, copy.fields.attributesHint)}
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={item ? copy.actions.save : copy.actions.create}
        pendingLabel={item ? copy.actions.saving : copy.actions.creating}
        className="self-start"
      />
    </form>
  )
}
