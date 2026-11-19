"use client"

import { useState, useTransition } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { subscribeAction } from "../server/actions"

/**
 * Sends only the plan id. The server picks the provider plan, the subject and
 * gets the hosted checkout URL; the browser just goes there.
 */
export function SubscribeButton({ planId }: { planId: string }) {
  const copy = useModuleCopy(es)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onClick = () => {
    setError(null)
    startTransition(async () => {
      const res = await subscribeAction(planId)
      if (res.ok && res.redirectTo?.startsWith("https://")) {
        window.location.assign(res.redirectTo)
        return
      }
      setError(res.ok ? copy.errors.provider_error : (res.formError ?? copy.errors.unknown))
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <SubmitButton
        type="button"
        onClick={onClick}
        pending={isPending}
        label={copy.catalog.subscribe}
        pendingLabel={copy.catalog.subscribing}
        className="self-start"
      />
    </div>
  )
}
