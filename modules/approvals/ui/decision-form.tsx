"use client"

import { useActionState, useId } from "react"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { decideAction, type DecideActionState } from "../server/actions"

export type DecisionOption = {
  action: string
  label: string
  comment: "none" | "optional" | "required"
}

/** One comment box, one submit button per available transition. */
export function DecisionForm({
  requestId,
  state,
  options,
  stateLabels,
}: {
  requestId: string
  state: string
  options: DecisionOption[]
  /** state key → label in the active locale, for the success message. */
  stateLabels: Record<string, string>
}) {
  const copy = useModuleCopy(es)
  const [result, formAction, pending] = useActionState<DecideActionState, FormData>(
    decideAction,
    { status: "idle" }
  )
  const commentId = useId()
  const hintId = `${commentId}-hint`
  const required = options.filter((o) => o.comment === "required")
  const takesComment = options.some((o) => o.comment !== "none")

  return (
    <form action={formAction} className="flex flex-col gap-3" aria-busy={pending}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedState" value={state} />
      {result.status === "error" ? (
        <FormAlert>{copy.errors[result.code]}</FormAlert>
      ) : null}
      {result.status === "ok" ? (
        <FormAlert variant="success">
          {copy.detail.done(stateLabels[result.to] ?? result.to)}
        </FormAlert>
      ) : null}
      {takesComment ? (
        <Field>
          <FieldLabel htmlFor={commentId}>{copy.detail.comment}</FieldLabel>
          <textarea
            id={commentId}
            name="comment"
            rows={3}
            maxLength={1000}
            readOnly={pending}
            aria-describedby={hintId}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <FieldDescription id={hintId}>
            {copy.detail.commentHint}
            {required.map((o) => ` · ${copy.detail.commentRequired(o.label)}`).join("")}
          </FieldDescription>
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <Button
            key={o.action}
            type="submit"
            name="action"
            value={o.action}
            variant={i === 0 ? "default" : "outline"}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? copy.detail.sending : o.label}
          </Button>
        ))}
      </div>
    </form>
  )
}
