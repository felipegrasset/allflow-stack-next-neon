"use client"

import { useId, useState, useTransition } from "react"
import Link from "next/link"

import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { MAX_LINE_QTY } from "../contracts/types"
import { es } from "../messages"
import { addToCartAction } from "../server/actions"

/** "Add to cart" for one catalog item. Sends the id and a quantity, nothing else. */
export function AddToCart({ itemId, withQuantity = true }: { itemId: string; withQuantity?: boolean }) {
  const copy = useModuleCopy(es)
  const qtyId = useId()
  const errorId = useId()
  const [qty, setQty] = useState("1")
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const n = Number(qty)
  const valid = /^\d{1,3}$/.test(qty) && n >= 1 && n <= MAX_LINE_QTY

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setResult(null)
        startTransition(async () => {
          const res = await addToCartAction({ itemId, qty: n })
          setResult(res.ok ? { ok: true, text: res.message ?? copy.cart.added } : { ok: false, text: res.error })
        })
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        {withQuantity ? (
          <div className="flex flex-col gap-1" data-invalid={!valid || undefined}>
            <label htmlFor={qtyId} className="text-sm font-medium">
              {copy.cart.addQty}
            </label>
            <Input
              id={qtyId}
              className="w-20"
              inputMode="numeric"
              value={qty}
              readOnly={isPending}
              aria-invalid={!valid || undefined}
              aria-describedby={result && !result.ok ? errorId : undefined}
              onChange={(e) => setQty(e.target.value.trim())}
            />
          </div>
        ) : null}
        <Button type="submit" disabled={isPending || !valid} aria-busy={isPending || undefined}>
          {copy.cart.add}
        </Button>
      </div>
      {result ? (
        result.ok ? (
          <FormAlert variant="success">
            {result.text}{" "}
            <Link href="/carrito" className="underline underline-offset-2">
              {copy.cart.viewCart}
            </Link>
          </FormAlert>
        ) : (
          <div id={errorId}>
            <FormAlert>{result.text}</FormAlert>
          </div>
        )
      ) : null}
    </form>
  )
}
