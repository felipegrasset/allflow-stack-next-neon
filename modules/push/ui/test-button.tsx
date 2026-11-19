"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { sendTestAction, type TestActionState } from "../server/actions"

/** Sends a test push to the signed-in person's own devices. */
export function TestButton() {
  const copy = useModuleCopy(es)
  const [result, formAction, pending] = useActionState<TestActionState, FormData>(sendTestAction, {
    status: "idle",
  })
  return (
    <form action={formAction} className="flex flex-col items-start gap-2" aria-busy={pending}>
      {result.status === "error" ? <FormAlert>{copy.errors[result.code]}</FormAlert> : null}
      {result.status === "ok" ? (
        <FormAlert variant={result.sent > 0 ? "success" : "destructive"}>
          {copy.test.sent(result.sent)}
          {result.removed > 0 ? ` ${copy.test.removed(result.removed)}` : ""}
          {result.failed > 0 ? ` ${copy.test.failed(result.failed)}` : ""}
        </FormAlert>
      ) : null}
      <SubmitButton pending={pending} variant="outline" label={copy.test.button} pendingLabel={copy.test.sending} />
    </form>
  )
}
