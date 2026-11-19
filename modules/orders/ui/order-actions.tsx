"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { cancelOrderAction, fulfillOrderAction, payOrderAction } from "../server/actions"

/**
 * The buttons of an order. Which ones show is decided on the server; every
 * action checks again (permission, ownership, status, payment).
 */
export function OrderActions({
  orderId,
  canPay,
  canCancel,
  canFulfill,
}: {
  orderId: string
  canPay: boolean
  canCancel: boolean
  canFulfill: boolean
}) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!canPay && !canCancel && !canFulfill) return null

  const run = (fn: () => Promise<void>) => {
    setError(null)
    setNotice(null)
    startTransition(fn)
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice ? <FormAlert variant="success">{notice}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        {canPay ? (
          <Button
            type="button"
            disabled={isPending}
            aria-busy={isPending || undefined}
            onClick={() =>
              run(async () => {
                const res = await payOrderAction(orderId)
                if (!res.ok) setError(res.error)
                else if ("message" in res) {
                  setNotice(res.message)
                  router.refresh()
                } else window.location.assign(res.url)
              })
            }
          >
            {isPending ? copy.detail.paying : copy.detail.pay}
          </Button>
        ) : null}
        {canFulfill ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                const res = await fulfillOrderAction(orderId)
                if (res.ok) {
                  setNotice(res.message ?? copy.detail.fulfilledOk)
                  router.refresh()
                } else setError(res.error)
              })
            }
          >
            {copy.detail.fulfill}
          </Button>
        ) : null}
        {canCancel && !confirming ? (
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setConfirming(true)}>
            {copy.detail.cancel}
          </Button>
        ) : null}
      </div>
      {canCancel && confirming ? (
        <div role="group" aria-label={copy.detail.cancel} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-sm">{copy.detail.cancelQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              aria-busy={isPending || undefined}
              onClick={() =>
                run(async () => {
                  const res = await cancelOrderAction(orderId)
                  setConfirming(false)
                  if (res.ok) {
                    setNotice(res.message ?? copy.detail.canceledOk)
                  } else setError(res.error)
                  router.refresh()
                })
              }
            >
              {copy.detail.cancelConfirm}
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirming(false)}>
              {copy.detail.keep}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
