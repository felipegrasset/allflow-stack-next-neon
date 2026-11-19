"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { optOutAction, type OptOutActionState } from "../server/actions"

/** One small form per number: records an opt-out from the team. */
export function OptOutButton({ phone }: { phone: string }) {
  const copy = useModuleCopy(es)
  const [result, formAction, pending] = useActionState<OptOutActionState, FormData>(optOutAction, {
    status: "idle",
  })
  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      aria-busy={pending}
      onSubmit={(e) => {
        // Only the person can undo an opt-out (by writing ALTA): ask first.
        if (!window.confirm(copy.consents.confirmOptOut(phone))) e.preventDefault()
      }}
    >
      <input type="hidden" name="phone" value={phone} />
      {result.status === "error" ? <FormAlert>{copy.errors[result.code]}</FormAlert> : null}
      {result.status === "ok" ? <FormAlert variant="success">{copy.consents.optOutDone}</FormAlert> : null}
      <SubmitButton
        pending={pending}
        variant="outline"
        label={copy.consents.optOut}
        pendingLabel={copy.consents.optingOut}
      />
    </form>
  )
}
