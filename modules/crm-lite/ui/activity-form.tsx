"use client"

import { useMemo, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { MANUAL_ACTIVITY_KINDS } from "../contracts/domain"
import { crmSchemas, type ActivityInput } from "../contracts/input"
import { es } from "../messages"
import { logActivityAction } from "../server/actions"
import { FormField, TEXTAREA_CLASS } from "./fields"

const EMPTY: ActivityInput = { kind: "note", body: "", dealId: "" }

/** Log a note, call, email or meeting on a contact, optionally tied to one of its deals. */
export function ActivityForm({
  contactId,
  deals,
}: {
  contactId: string
  deals: { id: string; name: string }[]
}) {
  const copy = useModuleCopy(es)
  const { activitySchema } = useMemo(
    () => crmSchemas(copy.validation),
    [copy]
  )
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<ActivityInput>({
    resolver: zodResolver(activitySchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setDone(null)
    startTransition(async () => {
      const res = await logActivityAction(contactId, values)
      if (res.ok) {
        reset(EMPTY)
        setDone(res.message ?? copy.actions.logged)
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(
          name as keyof ActivityInput,
          { message },
          { shouldFocus: !focused }
        )
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
      aria-label={copy.contact.logTitle}
    >
      {errors.root?.serverError ? (
        <FormAlert>{errors.root.serverError.message}</FormAlert>
      ) : null}
      {done ? <FormAlert variant="success">{done}</FormAlert> : null}
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="kind"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                id="crm-activity-kind"
                label={copy.fields.kind}
                fieldState={fieldState}
              >
                {(aria) => (
                  <NativeSelect {...field} {...aria} disabled={isPending}>
                    {MANUAL_ACTIVITY_KINDS.map((k) => (
                      <NativeSelectOption key={k} value={k}>
                        {copy.kinds[k]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
          />
          <Controller
            name="dealId"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                id="crm-activity-deal"
                label={copy.fields.deal}
                fieldState={fieldState}
              >
                {(aria) => (
                  <NativeSelect {...field} {...aria} disabled={isPending}>
                    <NativeSelectOption value="">
                      {copy.fields.noDeal}
                    </NativeSelectOption>
                    {deals.map((d) => (
                      <NativeSelectOption key={d.id} value={d.id}>
                        {d.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
          />
        </div>
        <Controller
          name="body"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id="crm-activity-body"
              label={copy.fields.body}
              fieldState={fieldState}
            >
              {(aria) => (
                <textarea
                  {...field}
                  {...aria}
                  rows={3}
                  readOnly={isPending}
                  className={TEXTAREA_CLASS}
                />
              )}
            </FormField>
          )}
        />
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={copy.actions.log}
        pendingLabel={copy.actions.logging}
        className="self-start"
      />
    </form>
  )
}
