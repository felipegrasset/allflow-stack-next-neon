"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import type { TicketStatus } from "../contracts/domain"
import { es } from "../messages"
import { changeStatusAction } from "../server/actions"

/** One button per status move the viewer may make (computed on the server; the action re-checks). */
export function StatusControls({ ticketId, moves }: { ticketId: string; moves: TicketStatus[] }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (moves.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert variant="success">{copy.detail.moved}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        {moves.map((m) => (
          <Button
            key={m}
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setError(null)
              setDone(false)
              startTransition(async () => {
                const res = await changeStatusAction(ticketId, m)
                if (res.ok) {
                  setDone(true)
                  router.refresh()
                } else setError(res.error)
              })
            }}
          >
            {copy.moves[m]}
          </Button>
        ))}
      </div>
    </div>
  )
}
