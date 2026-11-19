"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { markSeenAction } from "../server/actions"

/** Marks the lesson as seen. Safe to press twice: the server action is idempotent. */
export function MarkSeenButton({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {done ? <FormAlert variant="success">{copy.lesson.marked}</FormAlert> : null}
      <SubmitButton
        type="button"
        pending={isPending}
        label={copy.lesson.markSeen}
        pendingLabel={copy.lesson.marking}
        className="self-start"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const res = await markSeenAction(courseId, lessonId)
            if (res.ok) {
              setDone(true)
              router.refresh()
            } else setError(res.error)
          })
        }}
      />
    </div>
  )
}
