"use client"

import { useActionState, useId } from "react"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { submitFeedbackAction } from "../server/feedback-action"
import type { FeedbackState } from "../server/state"
import { TEXTAREA_CLASS } from "./field-row"

/** "¿Te sirvió?": two submit buttons and an optional comment. Public. */
export function FeedbackForm({ slug }: { slug: string }) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(submitFeedbackAction, {
    status: "idle",
  })
  const id = useId()
  const hintId = `${id}-hint`

  if (state.status === "ok")
    return (
      <FormAlert variant="success">{state.helpful ? copy.feedback.thanksYes : copy.feedback.thanksNo}</FormAlert>
    )

  return (
    <form action={formAction} className="flex flex-col gap-3" aria-busy={pending} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base font-medium">
        {copy.feedback.title}
      </h2>
      <input type="hidden" name="slug" value={slug} />
      {state.status === "error" ? <FormAlert>{state.message}</FormAlert> : null}
      <Field>
        <FieldLabel htmlFor={id}>{copy.feedback.commentLabel}</FieldLabel>
        <textarea
          id={id}
          name="comment"
          rows={3}
          maxLength={500}
          readOnly={pending}
          aria-describedby={hintId}
          className={TEXTAREA_CLASS}
        />
        <FieldDescription id={hintId}>{copy.feedback.commentHint}</FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="helpful" value="yes" disabled={pending} aria-busy={pending || undefined}>
          {pending ? copy.feedback.sending : copy.feedback.yes}
        </Button>
        <Button type="submit" name="helpful" value="no" variant="outline" disabled={pending} aria-busy={pending || undefined}>
          {pending ? copy.feedback.sending : copy.feedback.no}
        </Button>
      </div>
    </form>
  )
}
