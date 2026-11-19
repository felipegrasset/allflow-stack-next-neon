"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { runJobAction } from "../server/actions"

/** Starts a job by hand. Shown only to people with `job:run`; the action checks again. */
export function RunButton({ name }: { name: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const res = await runJobAction(name)
            if (!res.ok) setMessage({ text: res.error, ok: false })
            else setMessage({ text: copy.result[res.status], ok: res.status === "succeeded" })
            router.refresh()
          })
        }}
      >
        {isPending ? copy.jobs.running : copy.jobs.run}
      </Button>
      {message ? (
        <FormAlert variant={message.ok ? "success" : undefined}>{message.text}</FormAlert>
      ) : null}
    </div>
  )
}
