"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { redeemCodeAction, removeDiscountAction } from "../server/actions"

type Result =
  | { ok: true; message?: string }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<string, string>> }

/**
 * Type a discount code on YOUR pending order, or remove the one applied.
 * Sends only the order id and the code: the server checks the session, that
 * the order is yours and still pending (no payment started), applies the
 * code's rules and computes the amount from the stored order. After a change
 * it refreshes the page, so totals shown come from the server.
 *
 *   <DiscountCodeForm orderId={order.id} appliedCode={order.discountCode} />
 */
export function DiscountCodeForm({ orderId, appliedCode = null }: { orderId: string; appliedCode?: string | null }) {
  const copy = useModuleCopy(es)
  const r = copy.redeem
  const router = useRouter()
  const uid = useId()
  const [code, setCode] = useState("")
  const [isPending, startTransition] = useTransition()
  const [removing, setRemoving] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const error = result && !result.ok ? (result.fieldErrors?.code ?? result.formError) : undefined

  const run = (fn: () => Promise<Result>, isRemove: boolean) => {
    setResult(null)
    setRemoving(isRemove)
    startTransition(async () => {
      const res = await fn()
      setResult(res)
      if (res.ok) {
        setCode("")
        router.refresh()
      }
    })
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="text-base font-medium">
        {r.heading}
      </h2>
      {appliedCode ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>{r.current(appliedCode)}</span>
          <SubmitButton
            type="button"
            variant="outline"
            pending={isPending && removing}
            disabled={isPending}
            label={r.remove}
            pendingLabel={r.removing}
            onClick={() => run(() => removeDiscountAction({ orderId }), true)}
          />
        </p>
      ) : null}
      {result?.ok && result.message ? <FormAlert variant="success">{result.message}</FormAlert> : null}
      <form
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => redeemCodeAction({ orderId, code }), false)
        }}
      >
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-code`}>{r.field}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${uid}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              readOnly={isPending}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(`${uid}-desc`, error && `${uid}-err`)}
              className="max-w-xs uppercase"
            />
            <SubmitButton
              pending={isPending && !removing}
              disabled={isPending || code.trim() === ""}
              label={r.apply}
              pendingLabel={r.applying}
            />
          </div>
          <FieldDescription id={`${uid}-desc`}>{r.hint}</FieldDescription>
          {error ? <FieldError id={`${uid}-err`}>{error}</FieldError> : null}
        </Field>
      </form>
    </section>
  )
}
