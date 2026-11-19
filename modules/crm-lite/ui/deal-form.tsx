"use client"

import { useMemo, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import {
  CURRENCIES,
  DEAL_STAGES,
  DEFAULT_CURRENCY,
} from "../contracts/domain"
import { crmSchemas, type DealInput } from "../contracts/input"
import { es } from "../messages"
import { createDealAction } from "../server/actions"
import { FormField } from "./fields"

const EMPTY: DealInput = {
  name: "",
  amount: "",
  currency: DEFAULT_CURRENCY,
  stage: "new",
}

/** New deal for a contact. The amount is typed in major units and stored in minor units by the server. */
export function DealForm({ contactId }: { contactId: string }) {
  const copy = useModuleCopy(es)
  const { dealSchema } = useMemo(() => crmSchemas(copy.validation), [copy])
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<DealInput>({
    resolver: zodResolver(dealSchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setDone(null)
    startTransition(async () => {
      const res = await createDealAction(contactId, values)
      if (res.ok) {
        reset(EMPTY)
        setDone(res.message ?? copy.actions.dealCreated)
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(name as keyof DealInput, { message }, { shouldFocus: !focused })
        focused = true
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={copy.contact.newDealTitle}
    >
      {errors.root?.serverError ? (
        <FormAlert>{errors.root.serverError.message}</FormAlert>
      ) : null}
      {done ? <FormAlert variant="success">{done}</FormAlert> : null}
      <FieldGroup>
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id="crm-deal-name"
              label={copy.fields.dealName}
              fieldState={fieldState}
            >
              {(aria) => (
                <Input
                  {...field}
                  {...aria}
                  autoComplete="off"
                  readOnly={isPending}
                />
              )}
            </FormField>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Controller
            name="amount"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                id="crm-deal-amount"
                label={copy.fields.amount}
                description={copy.fields.amountHelp}
                fieldState={fieldState}
              >
                {(aria) => (
                  <Input
                    {...field}
                    {...aria}
                    inputMode="decimal"
                    autoComplete="off"
                    readOnly={isPending}
                  />
                )}
              </FormField>
            )}
          />
          <Controller
            name="currency"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                id="crm-deal-currency"
                label={copy.fields.currency}
                fieldState={fieldState}
              >
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
          name="stage"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id="crm-deal-stage"
              label={copy.fields.stage}
              fieldState={fieldState}
            >
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  {DEAL_STAGES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {copy.stages[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        />
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={copy.actions.createDeal}
        pendingLabel={copy.actions.creatingDeal}
        className="self-start"
      />
    </form>
  )
}
