"use client"

import { useActionState, useId, useState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { sendAction, type SendActionState } from "../server/actions"

const textareaClass =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/** Text or approved template. Consent and the 24 h window are checked on the server. */
export function SendForm() {
  const copy = useModuleCopy(es)
  const [mode, setMode] = useState<"text" | "template">("template")
  const [result, formAction, pending] = useActionState<SendActionState, FormData>(sendAction, {
    status: "idle",
  })
  const id = useId()
  const ids = {
    to: `${id}-to`,
    toHint: `${id}-to-hint`,
    mode: `${id}-mode`,
    text: `${id}-text`,
    name: `${id}-name`,
    lang: `${id}-lang`,
    langHint: `${id}-lang-hint`,
    params: `${id}-params`,
    paramsHint: `${id}-params-hint`,
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-busy={pending}>
      {result.status === "error" ? (
        <FormAlert>
          {result.code === "provider_error"
            ? copy.errors.provider_error(result.providerCode ?? "?")
            : copy.errors[result.code]}
        </FormAlert>
      ) : null}
      {result.status === "ok" ? <FormAlert variant="success">{copy.send.sent}</FormAlert> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={ids.to}>{copy.send.to}</FieldLabel>
          <Input
            id={ids.to}
            name="to"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            readOnly={pending}
            aria-describedby={describedBy(ids.toHint)}
          />
          <FieldDescription id={ids.toHint}>{copy.send.toHint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.mode}>{copy.send.mode}</FieldLabel>
          <NativeSelect
            id={ids.mode}
            name="mode"
            value={mode}
            disabled={pending}
            onChange={(e) => setMode(e.target.value === "text" ? "text" : "template")}
          >
            <NativeSelectOption value="template">{copy.send.modeTemplate}</NativeSelectOption>
            <NativeSelectOption value="text">{copy.send.modeText}</NativeSelectOption>
          </NativeSelect>
          {/* A disabled select is not submitted: keep the value while sending. */}
          {pending ? <input type="hidden" name="mode" value={mode} /> : null}
        </Field>
        {mode === "text" ? (
          <Field>
            <FieldLabel htmlFor={ids.text}>{copy.send.text}</FieldLabel>
            <textarea
              id={ids.text}
              name="text"
              rows={4}
              maxLength={4096}
              required
              readOnly={pending}
              className={textareaClass}
            />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor={ids.name}>{copy.send.templateName}</FieldLabel>
              <Input id={ids.name} name="templateName" required readOnly={pending} autoComplete="off" />
            </Field>
            <Field>
              <FieldLabel htmlFor={ids.lang}>{copy.send.templateLang}</FieldLabel>
              <Input
                id={ids.lang}
                name="templateLang"
                required
                defaultValue="es"
                readOnly={pending}
                autoComplete="off"
                aria-describedby={describedBy(ids.langHint)}
              />
              <FieldDescription id={ids.langHint}>{copy.send.templateLangHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={ids.params}>{copy.send.templateParams}</FieldLabel>
              <textarea
                id={ids.params}
                name="templateParams"
                rows={3}
                readOnly={pending}
                className={textareaClass}
                aria-describedby={describedBy(ids.paramsHint)}
              />
              <FieldDescription id={ids.paramsHint}>{copy.send.templateParamsHint}</FieldDescription>
            </Field>
          </>
        )}
      </FieldGroup>
      <div>
        <SubmitButton pending={pending} label={copy.send.submit} pendingLabel={copy.send.sending} />
      </div>
    </form>
  )
}
