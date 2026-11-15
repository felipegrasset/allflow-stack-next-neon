"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { catalogSchemas, type StockMoveFormValues } from "../contracts/input"
import { MANUAL_MOVE_REASONS } from "../contracts/types"
import { es } from "../messages"
import { adjustStockAction } from "../server/actions"
import { FormField } from "./fields"

const EMPTY: StockMoveFormValues = { reason: "restock", qty: "", note: "" }

/** Adds a stock move (restock or adjustment). The stock itself is never typed in. */
export function StockForm({ itemId }: { itemId: string }) {
  const copy = useModuleCopy(es)
  const { stockMoveSchema } = useMemo(() => catalogSchemas(copy.validation), [copy])
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
  } = useForm<StockMoveFormValues>({
    resolver: zodResolver(stockMoveSchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setSaved(null)
    startTransition(async () => {
      const res = await adjustStockAction(itemId, values)
      if (res.ok) {
        reset(EMPTY)
        setSaved(res.message ?? copy.actions.stockSaved)
        router.refresh()
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(name as keyof StockMoveFormValues, { message }, { shouldFocus: !focused })
        focused = true
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={copy.stock.formTitle}>
      {errors.root?.serverError ? <FormAlert>{errors.root.serverError.message}</FormAlert> : null}
      {saved ? <FormAlert variant="success">{saved}</FormAlert> : null}
      <FieldGroup>
        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <FormField id="catalog-stock-reason" label={copy.fields.reason} fieldState={fieldState}>
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  {MANUAL_MOVE_REASONS.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {copy.reasons[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        />
        <Controller
          name="qty"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id="catalog-stock-qty"
              label={copy.fields.qty}
              description={copy.fields.qtyHint}
              fieldState={fieldState}
            >
              {(aria) => (
                <Input {...field} {...aria} inputMode="numeric" autoComplete="off" readOnly={isPending} />
              )}
            </FormField>
          )}
        />
        <Controller
          name="note"
          control={control}
          render={({ field, fieldState }) => (
            <FormField id="catalog-stock-note" label={copy.fields.note} fieldState={fieldState}>
              {(aria) => <Input {...field} {...aria} autoComplete="off" readOnly={isPending} />}
            </FormField>
          )}
        />
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={copy.actions.addMove}
        pendingLabel={copy.actions.saving}
        className="self-start"
      />
    </form>
  )
}
