"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { resetSettingAction, saveSettingAction } from "../server/actions"

const TEXTAREA_CLASS =
  "min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"

type Props = {
  settingKey: string
  label: string
  description: string | null
  editor: "text" | "number" | "boolean" | "select" | "json"
  options: readonly string[] | null
  initial: string
  /** True when a value is stored (there is something to reset). */
  stored: boolean
  readOnly: boolean
}

/** Edits one setting. The server action re-checks permission and validates with the setting's schema. */
export function SettingForm({ settingKey, label, description, editor, options, initial, stored, readOnly }: Props) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const id = `settings-${settingKey.replace(/[^a-z0-9]/g, "-")}`
  const descId = description ? `${id}-description` : undefined
  const errId = `${id}-error`
  const describedBy = [descId, fieldError ? errId : undefined].filter(Boolean).join(" ") || undefined
  const aria = { id, "aria-invalid": fieldError ? (true as const) : undefined, "aria-describedby": describedBy }

  function run(fn: () => ReturnType<typeof saveSettingAction>) {
    setError(null)
    setFieldError(null)
    setOk(null)
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        setOk(res.message ?? copy.form.saved)
        router.refresh()
        return
      }
      if (res.fieldErrors?.value) setFieldError(res.fieldErrors.value)
      if (res.formError) setError(res.formError)
    })
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault()
        if (!readOnly) run(() => saveSettingAction(settingKey, value))
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      {ok ? <FormAlert variant="success">{ok}</FormAlert> : null}
      <Field data-invalid={fieldError ? true : undefined}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {editor === "boolean" || editor === "select" ? (
          <NativeSelect {...aria} value={value} disabled={readOnly || pending} onChange={(e) => setValue(e.target.value)}>
            {editor === "boolean" ? (
              <>
                <NativeSelectOption value="true">{copy.form.yes}</NativeSelectOption>
                <NativeSelectOption value="false">{copy.form.no}</NativeSelectOption>
              </>
            ) : (
              (options ?? []).map((o) => (
                <NativeSelectOption key={o} value={o}>
                  {o}
                </NativeSelectOption>
              ))
            )}
          </NativeSelect>
        ) : editor === "json" ? (
          <textarea
            {...aria}
            rows={6}
            spellCheck={false}
            className={TEXTAREA_CLASS}
            value={value}
            readOnly={readOnly || pending}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <Input
            {...aria}
            type={editor === "number" ? "number" : "text"}
            inputMode={editor === "number" ? "decimal" : undefined}
            autoComplete="off"
            value={value}
            readOnly={readOnly || pending}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {description ? <FieldDescription id={descId}>{description}</FieldDescription> : null}
        {fieldError ? <FieldError id={errId}>{fieldError}</FieldError> : null}
      </Field>
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} label={copy.form.save} pendingLabel={copy.form.saving} />
          {stored ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => resetSettingAction(settingKey))}
            >
              {copy.form.reset}
            </Button>
          ) : null}
        </div>
      )}
    </form>
  )
}
