"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

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
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { cancelSubscriptionAction, changePlanAction } from "../server/actions"

type Notice = { kind: "success" | "error"; text: string } | null

function NoticeAlert({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <FormAlert variant={notice.kind === "success" ? "success" : "destructive"}>{notice.text}</FormAlert>
  )
}

/**
 * "Switch to this plan": a dialog says how the provider charges the change
 * BEFORE asking (text from payments' documentation, no invented amounts).
 * Sends only the plan id. After asking, the page does NOT pretend the plan
 * changed: it refreshes and shows "requested, waiting for the provider".
 */
export function ChangePlanButton({
  planId,
  planLabel,
  provider,
}: {
  planId: string
  planLabel: string
  provider: string | null
}) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const billing = provider === "paddle" ? copy.change.billing.paddle : copy.change.billing.other

  const onConfirm = () => {
    setOpen(false)
    setNotice(null)
    startTransition(async () => {
      const res = await changePlanAction(planId)
      if (res.ok) {
        setNotice({ kind: "success", text: res.message ?? copy.change.requested })
        router.refresh()
      } else {
        setNotice({ kind: "error", text: res.formError ?? copy.errors.unknown })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <NoticeAlert notice={notice} />
      <SubmitButton
        type="button"
        onClick={() => setOpen(true)}
        pending={isPending}
        label={copy.catalog.changeTo}
        pendingLabel={copy.change.pending}
        className="self-start"
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.change.confirmTitle(planLabel)}</AlertDialogTitle>
            <AlertDialogDescription>{copy.change.confirmIntro}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{billing}</p>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.change.cancel}</AlertDialogCancel>
            <Button onClick={onConfirm}>{copy.change.confirm}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Cancel the live subscription: at period end by default; "now" is an explicit, warned choice. */
export function CancelSubscriptionButton({ periodEndLabel }: { periodEndLabel: string | null }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [atPeriodEnd, setAtPeriodEnd] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)

  const onConfirm = () => {
    setOpen(false)
    setNotice(null)
    startTransition(async () => {
      const res = await cancelSubscriptionAction({ atPeriodEnd })
      if (res.ok) {
        setNotice({ kind: "success", text: res.message ?? copy.cancel.requested })
        router.refresh()
      } else {
        setNotice({ kind: "error", text: res.formError ?? copy.errors.unknown })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <NoticeAlert notice={notice} />
      <SubmitButton
        type="button"
        variant="outline"
        onClick={() => {
          setAtPeriodEnd(true)
          setOpen(true)
        }}
        pending={isPending}
        label={copy.cancel.button}
        pendingLabel={copy.cancel.pending}
        className="self-start"
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.cancel.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.cancel.intro}</AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="sr-only">{copy.cancel.title}</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="plans-cancel-when"
                checked={atPeriodEnd}
                onChange={() => setAtPeriodEnd(true)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>{periodEndLabel ? copy.cancel.atPeriodEndDate(periodEndLabel) : copy.cancel.atPeriodEnd}</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="plans-cancel-when"
                checked={!atPeriodEnd}
                onChange={() => setAtPeriodEnd(false)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>{copy.cancel.now}</span>
            </label>
          </fieldset>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel.back}</AlertDialogCancel>
            <Button variant={atPeriodEnd ? "default" : "destructive"} onClick={onConfirm}>
              {copy.cancel.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
