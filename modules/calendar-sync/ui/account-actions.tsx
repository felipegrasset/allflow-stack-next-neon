"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { disconnectAction, syncNowAction, type ActionState } from "../server/actions"

/** "Sync now" and "Disconnect", each its own small form. */
export function AccountActions() {
  const copy = useModuleCopy(es)
  const [sync, syncAction, syncing] = useActionState<ActionState, FormData>(syncNowAction, { status: "idle" })
  const [disc, discAction, disconnecting] = useActionState<ActionState, FormData>(disconnectAction, {
    status: "idle",
  })
  const result = sync.status !== "idle" ? sync : disc
  return (
    <div className="flex flex-col gap-3">
      {result.status === "error" ? <FormAlert>{copy.errors[result.code]}</FormAlert> : null}
      {sync.status === "ok" ? <FormAlert variant="success">{copy.actions.synced(sync.n ?? 0)}</FormAlert> : null}
      {disc.status === "ok" ? <FormAlert variant="success">{copy.actions.disconnected}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <form action={syncAction} aria-busy={syncing}>
          <SubmitButton pending={syncing} label={copy.actions.syncNow} pendingLabel={copy.actions.syncing} />
        </form>
        <form
          action={discAction}
          aria-busy={disconnecting}
          onSubmit={(e) => {
            if (!window.confirm(copy.actions.confirmDisconnect)) e.preventDefault()
          }}
        >
          <SubmitButton
            pending={disconnecting}
            variant="outline"
            label={copy.actions.disconnect}
            pendingLabel={copy.actions.disconnecting}
          />
        </form>
      </div>
    </div>
  )
}
