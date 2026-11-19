"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { saveEmailPreferenceAction } from "../server/actions"

/** The server action re-checks session and permission. */
export function PreferenceForm({ initial }: { initial: boolean }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        setOk(null)
        startTransition(async () => {
          const res = await saveEmailPreferenceAction({ enabled })
          if (res.ok) {
            setOk(res.message ?? copy.form.saved)
            router.refresh()
          } else setError(res.formError ?? copy.errors.generic)
        })
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      {ok ? <FormAlert variant="success">{ok}</FormAlert> : null}
      <Field>
        <div className="flex items-center gap-2">
          <input
            id="notifications-email-enabled"
            type="checkbox"
            className="size-4 accent-primary"
            checked={enabled}
            disabled={pending}
            aria-describedby="notifications-email-hint"
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <FieldLabel htmlFor="notifications-email-enabled">{copy.page.toggleLabel}</FieldLabel>
        </div>
        <FieldDescription id="notifications-email-hint">{copy.page.toggleHint}</FieldDescription>
      </Field>
      <div>
        <SubmitButton pending={pending} label={copy.form.save} pendingLabel={copy.form.saving} />
      </div>
    </form>
  )
}
