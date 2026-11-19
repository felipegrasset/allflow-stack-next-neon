"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { deleteCommentAction } from "../server/actions"

/** Shown to the author and to moderators; the action re-checks everything. */
export function DeleteButton({ grant, commentId, authorName }: { grant: string; commentId: string; authorName: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={isPending}
        aria-busy={isPending || undefined}
        aria-label={copy.deleteLabel(authorName)}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const res = await deleteCommentAction(grant, commentId)
            if (res.ok) router.refresh()
            else setError(res.error)
          })
        }}
      >
        {isPending ? copy.deleting : copy.delete}
      </Button>
    </div>
  )
}
