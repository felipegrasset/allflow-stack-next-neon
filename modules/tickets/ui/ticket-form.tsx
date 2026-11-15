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

import { TICKET_PRIORITIES } from "../contracts/domain"
import { ticketSchemas, type CreateTicketInput } from "../contracts/input"
import { es } from "../messages"
import { createTicketAction } from "../server/actions"
import { FormField, TEXTAREA_CLASS } from "./fields"

/** New ticket: subject, description and priority. */
export function TicketForm() {
  const copy = useModuleCopy(es)
  const { createSchema } = useMemo(() => ticketSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, setError } = useForm<CreateTicketInput>({
    resolver: zodResolver(createSchema),
    mode: "onBlur",
    defaultValues: { subject: "", body: "", priority: "normal" },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const res = await createTicketAction(values)
      if (res.ok) {
        if (res.redirectTo) router.push(res.redirectTo)
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(name as keyof CreateTicketInput, { message }, { shouldFocus: !focused })
        focused = true
      }
      if (res.formError) setServerError(res.formError)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={copy.list.newTitle}>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Controller
          name="subject"
          control={control}
          render={({ field, fieldState }) => (
            <FormField id="tickets-new-subject" label={copy.form.subject} fieldState={fieldState}>
              {(aria) => <Input {...field} {...aria} autoComplete="off" maxLength={200} readOnly={isPending} />}
            </FormField>
          )}
        />
        <Controller
          name="body"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id="tickets-new-body"
              label={copy.form.body}
              description={copy.form.bodyHint}
              fieldState={fieldState}
            >
              {(aria) => (
                <textarea {...field} {...aria} rows={5} maxLength={5000} readOnly={isPending} className={TEXTAREA_CLASS} />
              )}
            </FormField>
          )}
        />
        <Controller
          name="priority"
          control={control}
          render={({ field, fieldState }) => (
            <FormField id="tickets-new-priority" label={copy.form.priority} fieldState={fieldState}>
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  {TICKET_PRIORITIES.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {copy.priorities[p]}
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
        label={copy.form.submit}
        pendingLabel={copy.form.submitting}
        className="self-start"
      />
    </form>
  )
}
