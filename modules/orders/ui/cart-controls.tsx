"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { MAX_LINE_QTY } from "../contracts/types"
import { es } from "../messages"
import { removeUnavailableAction, setCartQtyAction } from "../server/actions"

/** Quantity field + update/remove for one cart line. */
export function CartLineControls({ itemId, qty, name }: { itemId: string; qty: number; name: string }) {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [value, setValue] = useState(String(qty))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const n = Number(value)
  const valid = /^\d{1,3}$/.test(value) && n >= 0 && n <= MAX_LINE_QTY

  const send = (next: number) => {
    setError(null)
    startTransition(async () => {
      const res = await setCartQtyAction({ itemId, qty: next })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={copy.cart.qtyLabel(name)}
          className="w-20"
          inputMode="numeric"
          value={value}
          readOnly={isPending}
          aria-invalid={!valid || undefined}
          onChange={(e) => setValue(e.target.value.trim())}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !valid || n === qty}
          aria-busy={isPending || undefined}
          onClick={() => send(n)}
        >
          {copy.cart.update}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => send(0)}>
          {copy.cart.remove}
        </Button>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  )
}

/** Removes the lines catalog no longer sells. */
export function RemoveUnavailable() {
  const copy = useModuleCopy(es)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const res = await removeUnavailableAction()
              if (res.ok) router.refresh()
              else setError(res.error)
            })
          }}
        >
          {copy.cart.remove}
        </Button>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  )
}
