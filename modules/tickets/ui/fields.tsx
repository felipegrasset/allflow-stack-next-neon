"use client"

import type { ControllerFieldState } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { describedBy } from "@/lib/forms"

/** One form field with the a11y rules of CONVENTIONS.md §2 (label, invalid state, description + error ids). */
export function FormField({
  id,
  label,
  description,
  fieldState,
  children,
}: {
  id: string
  label: string
  description?: string
  fieldState: ControllerFieldState
  children: (aria: {
    id: string
    "aria-invalid": true | undefined
    "aria-describedby": string | undefined
  }) => React.ReactNode
}) {
  const descId = description ? `${id}-description` : undefined
  const errId = `${id}-error`
  return (
    <Field data-invalid={fieldState.invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        "aria-invalid": fieldState.invalid || undefined,
        "aria-describedby": describedBy(descId, fieldState.invalid && errId),
      })}
      {description ? <FieldDescription id={descId}>{description}</FieldDescription> : null}
      {fieldState.invalid ? <FieldError id={errId}>{fieldState.error?.message}</FieldError> : null}
    </Field>
  )
}

/** Multi-line text styled like `components/ui/input` (there is no Textarea in ui/). */
export const TEXTAREA_CLASS =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
