"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { DomainCopy } from "@/lib/domain/meta"
import type { FormResult } from "@/lib/schemas/auth"

type Action = (id: string) => Promise<FormResult<never>>

/**
 * Delete (asks once, in place) and approve, for the detail screen of an
 * entity. The Server Actions are passed in by the generated page; each one
 * re-checks permissions on the server. Copied by AllFlow's genesis from
 * `genesis/templates/components/domain/`.
 */
export function EntityActions({
  id,
  listHref,
  onDelete,
  onApprove,
  approveLabel,
  copy,
}: {
  id: string
  listHref: string
  onDelete: Action | null
  onApprove: Action | null
  approveLabel: string
  copy: DomainCopy
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (action: Action, then: "list" | "refresh") => {
    setError(null)
    startTransition(async () => {
      const res = await action(id)
      if (!res.ok) {
        setConfirming(false)
        setError(res.formError ?? copy.serverError)
        return
      }
      if (res.message) toast.add({ title: res.message, type: "success" })
      if (then === "list") router.push(listHref)
      router.refresh()
    })
  }

  if (!onDelete && !onApprove) return null
  return (
    <div className="flex flex-col gap-3" aria-label={copy.actions} role="group">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap items-center gap-2">
        {onApprove && (
          <SubmitButton
            type="button"
            pending={pending && !confirming}
            label={approveLabel}
            pendingLabel={copy.approving}
            disabled={pending}
            onClick={() => run(onApprove, "refresh")}
          />
        )}
        {onDelete && !confirming && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
            {copy.delete}
          </Button>
        )}
        {onDelete && confirming && (
          <>
            <span className="text-sm" role="status">
              {copy.deleteConfirm}
            </span>
            <SubmitButton
              type="button"
              variant="destructive"
              pending={pending}
              label={copy.deleteConfirmYes}
              pendingLabel={copy.deleting}
              onClick={() => run(onDelete, "list")}
            />
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              {copy.cancel}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
