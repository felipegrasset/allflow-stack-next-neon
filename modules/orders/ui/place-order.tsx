"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { placeOrderAction } from "../server/actions"

/**
 * Sends what the person SAW (subtotal + currency) so the server can refuse if
 * prices changed. The server computes and stores its own total either way.
 */
export function PlaceOrder({ expectedSubtotalMinor, currency }: { expectedSubtotalMinor: number; currency: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div>
        <Button
          type="button"
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const res = await placeOrderAction({ expectedSubtotalMinor, currency })
              if (res.ok) router.push(res.redirectTo)
              else {
                setError(res.error)
                router.refresh()
              }
            })
          }}
        >
          {isPending ? copy.checkout.placing : copy.checkout.place}
        </Button>
      </div>
    </div>
  )
}
