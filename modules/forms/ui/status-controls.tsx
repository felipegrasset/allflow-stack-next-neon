"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import type { FormStatus } from "../contracts/types"
import { es } from "../messages"
import { deleteFormAction, setStatusAction, type SimpleState } from "../server/actions"

const NEXT: Record<FormStatus, { to: FormStatus; label: "publish" | "close" | "reopen" }> = {
  draft: { to: "open", label: "publish" },
  open: { to: "closed", label: "close" },
  closed: { to: "open", label: "reopen" },
}

/** Publish / close / reopen, and delete (with a confirmation). Both re-check `form:write` on the server. */
export function StatusControls({ id, status }: { id: string; status: FormStatus }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [statusState, statusAction, statusPending] = useActionState<SimpleState, FormData>(setStatusAction, {
    status: "idle",
  })
  const [deleteState, deleteAction, deletePending] = useActionState<SimpleState, FormData>(deleteFormAction, {
    status: "idle",
  })
  const next = NEXT[status]

  useEffect(() => {
    if (deleteState.status === "ok") router.push("/forms")
  }, [deleteState, router])

  const error = statusState.status === "error" ? statusState : deleteState.status === "error" ? deleteState : null

  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert>{copy.errors[error.code]}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <form action={statusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={next.to} />
          <Button type="submit" disabled={statusPending} aria-busy={statusPending || undefined}>
            {statusPending ? copy.actions.working : copy.actions[next.label]}
          </Button>
        </form>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm(copy.actions.deleteConfirm)) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" disabled={deletePending} aria-busy={deletePending || undefined}>
            {copy.actions.delete}
          </Button>
        </form>
      </div>
    </div>
  )
}
