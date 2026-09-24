"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { profileCopy } from "@/lib/copy/profile"
import { revokeOtherSessionsAction } from "../actions"

export function SessionsCard({ count }: { count: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const c = profileCopy.security

  const revoke = () => {
    setConfirmOpen(false)
    setError(null)
    startTransition(async () => {
      const res = await revokeOtherSessionsAction()
      if (!res.ok) return setError(res.formError ?? c.revokeFailed)
      toast.add({ title: c.revoked, type: "success" })
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{c.sessionsTitle}</h2>
        </CardTitle>
        <CardDescription data-testid="sessions-count">{c.sessionsDescription(count)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div>
          <SubmitButton
            type="button"
            variant="outline"
            pending={isPending}
            disabled={count <= 1}
            label={c.revokeButton}
            pendingLabel={c.revoking}
            onClick={() => setConfirmOpen(true)}
          />
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{c.revokeConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{c.revokeConfirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{profileCopy.common.cancel}</AlertDialogCancel>
              <Button variant="destructive" onClick={revoke}>
                {c.revokeButton}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
