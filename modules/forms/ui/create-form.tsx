"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { createFormAction, type CreateFormState } from "../server/actions"
import { TEXTAREA_CLASS } from "./styles"

/**
 * Not a `<form action>`: React resets uncontrolled fields after an action, and
 * a long JSON definition must survive a validation error. We submit by hand.
 */
export function CreateForm({ starter }: { starter: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [state, setState] = useState<CreateFormState>({ status: "idle" })
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (state.status === "ok") router.push(`/forms/${state.id}`)
  }, [state, router])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      setState(await createFormAction({ status: "idle" }, data))
    })
  }

  const slugInvalid = state.status === "error" && state.code === "slug_taken"
  const defInvalid = state.status === "error" && (state.code === "invalid_json" || state.code === "invalid_definition")

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={pending} noValidate>
      {state.status === "error" ? (
        <FormAlert title={state.code === "invalid_definition" ? copy.create.issuesTitle : undefined}>
          {state.code === "invalid_definition" && state.issues ? (
            <ul className="list-disc pl-4">
              {state.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            copy.errors[state.code]
          )}
        </FormAlert>
      ) : null}
      <Field data-invalid={slugInvalid || undefined}>
        <FieldLabel htmlFor="forms-slug">{copy.create.slugLabel}</FieldLabel>
        <Input
          id="forms-slug"
          name="slug"
          required
          maxLength={63}
          autoComplete="off"
          aria-invalid={slugInvalid || undefined}
          aria-describedby="forms-slug-hint"
        />
        <FieldDescription id="forms-slug-hint">{copy.create.slugHint}</FieldDescription>
      </Field>
      <Field data-invalid={defInvalid || undefined}>
        <FieldLabel htmlFor="forms-definition">{copy.create.definitionLabel}</FieldLabel>
        <textarea
          id="forms-definition"
          name="definition"
          rows={16}
          spellCheck={false}
          defaultValue={starter}
          aria-invalid={defInvalid || undefined}
          aria-describedby="forms-definition-hint"
          className={`${TEXTAREA_CLASS} font-mono`}
        />
        <FieldDescription id="forms-definition-hint">{copy.create.definitionHint}</FieldDescription>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="onePerPerson" className="size-4 accent-primary" />
        {copy.create.onePerPerson}
      </label>
      <div>
        <SubmitButton pending={pending} label={copy.create.submit} pendingLabel={copy.create.sending} />
      </div>
    </form>
  )
}
