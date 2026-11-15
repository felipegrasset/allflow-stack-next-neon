"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { ticketSchemas, type ReplyInput } from "../contracts/input"
import { es } from "../messages"
import { replyAction } from "../server/actions"
import { FormField, TEXTAREA_CLASS } from "./fields"

/** Answer on a ticket (the requester or, with `ticket:manage`, the staff). */
export function ReplyForm({ ticketId }: { ticketId: string }) {
  const copy = useModuleCopy(es)
  const { replySchema } = useMemo(() => ticketSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const { control, handleSubmit, setError, reset } = useForm<ReplyInput>({
    resolver: zodResolver(replySchema),
    mode: "onBlur",
    defaultValues: { body: "" },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    setSent(null)
    startTransition(async () => {
      const res = await replyAction(ticketId, values)
      if (res.ok) {
        reset({ body: "" })
        setSent(res.message ?? copy.detail.sent)
        router.refresh()
        return
      }
      const msg = res.fieldErrors?.body
      if (msg) setError("body", { message: msg }, { shouldFocus: true })
      if (res.formError) setServerError(res.formError)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={copy.detail.replyLabel}>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      {sent ? <FormAlert variant="success">{sent}</FormAlert> : null}
      <Controller
        name="body"
        control={control}
        render={({ field, fieldState }) => (
          <FormField id="tickets-reply-body" label={copy.detail.replyLabel} fieldState={fieldState}>
            {(aria) => (
              <textarea {...field} {...aria} rows={4} maxLength={5000} readOnly={isPending} className={TEXTAREA_CLASS} />
            )}
          </FormField>
        )}
      />
      <SubmitButton
        pending={isPending}
        label={copy.detail.send}
        pendingLabel={copy.detail.sending}
        className="self-start"
      />
    </form>
  )
}
