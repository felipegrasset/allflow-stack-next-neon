import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { describedBy } from "@/lib/forms"

/**
 * One form field with the a11y rules of CONVENTIONS.md §2 (`data-invalid` on
 * the wrapper; `aria-invalid` and `aria-describedby` on the control).
 */
export function FieldRow({
  id,
  label,
  description,
  error,
  children,
}: {
  id: string
  label: string
  description?: string
  error?: string
  children: (aria: {
    id: string
    "aria-invalid": true | undefined
    "aria-describedby": string | undefined
  }) => React.ReactNode
}) {
  const descId = description ? `${id}-description` : undefined
  const errId = `${id}-error`
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy(descId, error && errId),
      })}
      {description ? <FieldDescription id={descId}>{description}</FieldDescription> : null}
      {error ? <FieldError id={errId}>{error}</FieldError> : null}
    </Field>
  )
}

/** Multi-line text styled like `components/ui/input` (there is no Textarea in ui/). */
export const TEXTAREA_CLASS =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
