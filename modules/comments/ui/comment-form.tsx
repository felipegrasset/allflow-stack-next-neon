"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { NativeSelect } from "@/components/ui/native-select"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { COMMENT_MAX } from "../contracts/domain"
import { commentSchemas, type AddCommentInput } from "../contracts/input"
import { es } from "../messages"
import { addCommentAction } from "../server/actions"

const TEXTAREA_CLASS =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

/**
 * New comment. `grant` is the signed access token from `<Comments>`; `people`
 * are NAMES only (people who can see the record): picking one inserts `@Name`.
 */
export function CommentForm({ grant, people, formId }: { grant: string; people: string[]; formId: string }) {
  const copy = useModuleCopy(es)
  const { addSchema } = useMemo(() => commentSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const { control, handleSubmit, setError, setValue, getValues, reset } = useForm<AddCommentInput>({
    resolver: zodResolver(addSchema),
    mode: "onBlur",
    defaultValues: { body: "" },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    setSent(null)
    startTransition(async () => {
      const res = await addCommentAction(grant, values)
      if (res.ok) {
        reset({ body: "" })
        setSent(res.message ?? copy.added)
        router.refresh()
        return
      }
      const msg = res.fieldErrors?.body
      if (msg) setError("body", { message: msg }, { shouldFocus: true })
      if (res.formError) setServerError(res.formError)
    })
  })

  const bodyId = `${formId}-body`
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={copy.bodyLabel}>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      {sent ? <FormAlert variant="success">{sent}</FormAlert> : null}
      <Controller
        name="body"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={bodyId}>{copy.bodyLabel}</FieldLabel>
            <textarea
              {...field}
              ref={(el) => {
                field.ref(el)
                areaRef.current = el
              }}
              id={bodyId}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={`${bodyId}-hint${fieldState.invalid ? ` ${bodyId}-error` : ""}`}
              rows={3}
              maxLength={COMMENT_MAX}
              readOnly={isPending}
              className={TEXTAREA_CLASS}
            />
            <FieldDescription id={`${bodyId}-hint`}>{copy.bodyHint}</FieldDescription>
            {fieldState.invalid ? <FieldError id={`${bodyId}-error`}>{fieldState.error?.message}</FieldError> : null}
          </Field>
        )}
      />
      <div className="flex flex-wrap items-end gap-3">
        {people.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-mention`} className="text-sm text-muted-foreground">
              {copy.mentionLabel}
            </label>
            <NativeSelect
              id={`${formId}-mention`}
              value=""
              disabled={isPending}
              onChange={(e) => {
                const name = e.target.value
                if (!name) return
                const cur = getValues("body")
                const sep = cur.length === 0 || /\s$/.test(cur) ? "" : " "
                setValue("body", `${cur}${sep}@${name} `, { shouldDirty: true })
                areaRef.current?.focus()
              }}
            >
              <option value="">{copy.mentionPlaceholder}</option>
              {people.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <SubmitButton pending={isPending} label={copy.submit} pendingLabel={copy.submitting} />
      </div>
    </form>
  )
}
