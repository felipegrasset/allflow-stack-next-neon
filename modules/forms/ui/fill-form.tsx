"use client"

import { useState, useTransition } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import type { AnswerErrorCode } from "../contracts/answers"
import { resolveText, type Field as FormField, type FormDefinition } from "../contracts/definition"
import { CONTROL_PREFIX, HONEYPOT_FIELD } from "../contracts/names"
import { es } from "../messages"
import { submitResponseAction, type SubmitState } from "../server/public-actions"
import { CHOICE_CLASS, TEXTAREA_CLASS } from "./styles"

type Copy = ReturnType<typeof useModuleCopy<typeof es>>

/**
 * The public form. Submitted by hand (not `<form action>`) so a validation
 * error keeps what the person typed. `noValidate`: the server is the judge
 * and its messages are the ones in the catalog.
 */
export function FillForm({
  slug,
  definition,
  locale,
}: {
  slug: string
  definition: FormDefinition
  locale: string
}) {
  const copy = useModuleCopy(es)
  const [state, setState] = useState<SubmitState>({ status: "idle" })
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      setState(await submitResponseAction({ status: "idle" }, data))
    })
  }

  if (state.status === "ok")
    return (
      <FormAlert variant="success">
        {definition.thanks ? resolveText(definition.thanks, locale) : copy.public.thanks}
      </FormAlert>
    )

  const fieldErrors = state.status === "error" ? (state.fields ?? {}) : {}

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="flex flex-col gap-6">
      <input type="hidden" name="slug" value={slug} />
      {/* Decoy for bots: out of sight, out of the tab order, ignored by screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {state.status === "error" ? (
        <FormAlert>{state.fields ? copy.public.fixErrors : copy.errors[state.code]}</FormAlert>
      ) : null}
      {definition.fields.map((f) => (
        <Control key={f.id} field={f} error={fieldErrors[f.id]} copy={copy} locale={locale} />
      ))}
      <div>
        <SubmitButton pending={pending} label={copy.public.submit} pendingLabel={copy.public.sending} />
      </div>
    </form>
  )
}

function Control({
  field,
  error,
  copy,
  locale,
}: {
  field: FormField
  error: AnswerErrorCode | undefined
  copy: Copy
  locale: string
}) {
  const name = CONTROL_PREFIX + field.id
  const id = `forms-${field.id}`
  const helpId = field.help ? `${id}-help` : undefined
  const errId = `${id}-error`
  const label = resolveText(field.label, locale)
  const invalid = error !== undefined
  const described = describedBy(helpId, invalid && errId)
  const required = field.required ? (
    <span className="font-normal text-muted-foreground">{` (${copy.public.requiredMark})`}</span>
  ) : null
  const help = field.help ? <FieldDescription id={helpId}>{resolveText(field.help, locale)}</FieldDescription> : null
  const err = invalid ? <FieldError id={errId}>{copy.fieldErrors[error]}</FieldError> : null

  switch (field.type) {
    case "single":
    case "multiple":
    case "scale": {
      const isScale = field.type === "scale"
      const options = isScale
        ? Array.from({ length: field.to - field.from + 1 }, (_, i) => ({ value: String(field.from + i), text: String(field.from + i) }))
        : field.options.map((o) => ({ value: o.value, text: resolveText(o.label, locale) }))
      return (
        <FieldSet data-invalid={invalid || undefined} aria-describedby={described}>
          <FieldLegend variant="label">
            {label}
            {required}
          </FieldLegend>
          {help}
          <div className={isScale ? "flex flex-wrap gap-4" : "flex flex-col gap-2"}>
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type={field.type === "multiple" ? "checkbox" : "radio"}
                  name={name}
                  value={o.value}
                  aria-invalid={invalid || undefined}
                  className={CHOICE_CLASS}
                />
                {o.text}
              </label>
            ))}
          </div>
          {isScale && (field.lowLabel || field.highLabel) ? (
            <p className="flex justify-between gap-4 text-xs text-muted-foreground">
              <span>{field.lowLabel ? resolveText(field.lowLabel, locale) : ""}</span>
              <span>{field.highLabel ? resolveText(field.highLabel, locale) : ""}</span>
            </p>
          ) : null}
          {err}
        </FieldSet>
      )
    }
    case "consent":
      return (
        <Field data-invalid={invalid || undefined}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              id={id}
              aria-invalid={invalid || undefined}
              aria-describedby={described}
              className={`${CHOICE_CLASS} mt-0.5`}
            />
            <span>
              {label}
              {required}
            </span>
          </label>
          {help}
          {err}
        </Field>
      )
    case "textarea":
      return (
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor={id}>
            {label}
            {required}
          </FieldLabel>
          <textarea
            id={id}
            name={name}
            rows={4}
            maxLength={field.maxLength}
            aria-invalid={invalid || undefined}
            aria-describedby={described}
            aria-required={field.required || undefined}
            className={TEXTAREA_CLASS}
          />
          {help}
          {err}
        </Field>
      )
    default: {
      const type = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"
      return (
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor={id}>
            {label}
            {required}
          </FieldLabel>
          <Input
            id={id}
            name={name}
            type={type}
            maxLength={field.type === "text" ? field.maxLength : undefined}
            min={field.type === "number" || field.type === "date" ? field.min : undefined}
            max={field.type === "number" || field.type === "date" ? field.max : undefined}
            step={field.type === "number" ? (field.integer ? 1 : "any") : undefined}
            autoComplete={field.type === "email" ? "email" : "off"}
            aria-invalid={invalid || undefined}
            aria-describedby={described}
            aria-required={field.required || undefined}
          />
          {help}
          {err}
        </Field>
      )
    }
  }
}
