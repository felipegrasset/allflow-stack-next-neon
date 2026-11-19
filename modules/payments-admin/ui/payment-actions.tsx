"use client"

import { useLocale } from "next-intl"
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { describedBy } from "@/lib/forms"
import { DEFAULT_LOCALE, formatCurrency, isLocale } from "@/modules/i18n/contracts"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { es } from "../messages"
import { refundPaymentAction, syncPaymentAction, type RefundError } from "../server/actions"
import { parseMajorAmount, type AdminPaymentStatus } from "../server/logic"

type Notice = { kind: "success" | "error"; text: string } | null

/**
 * "Check with the provider" and the refund form. The amount typed here is
 * only a request: the Server Action re-reads the payment, re-parses the
 * amount with the currency's exponent and re-checks everything. The refund
 * always goes through a confirmation dialog that names the amount.
 */
export function PaymentActions({
  orderId,
  paymentId,
  status,
  currency,
  exponent,
  refundedMinor,
  refundableMinor,
  canRefund,
}: {
  orderId: string
  paymentId: string
  status: AdminPaymentStatus
  currency: string
  exponent: number
  refundedMinor: number
  refundableMinor: number
  canRefund: boolean
}) {
  const copy = useModuleCopy(es)
  const rawLocale = useLocale()
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const router = useRouter()
  const money = (minor: number) => formatCurrency(minor / 10 ** exponent, currency, locale)

  const [syncing, startSync] = useTransition()
  const [refunding, startRefund] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const [amount, setAmount] = useState("")
  const [amountError, setAmountError] = useState<string | null>(null)
  const [confirmMinor, setConfirmMinor] = useState<number | null>(null)
  // A refund only shows up in the record when the provider confirms it; until
  // then, block a second request from this screen (see MODULE.md).
  const [requested, setRequested] = useState(false)

  const refundErrorText = (e: RefundError | "forbidden") =>
    e === "invalid" ? copy.refund.errors.format : copy.refund.errors[e]

  const onSync = () => {
    setNotice(null)
    startSync(async () => {
      const res = await syncPaymentAction({ paymentId })
      if (res.ok) {
        setNotice({ kind: "success", text: copy.sync.done })
        router.refresh()
      } else {
        setNotice({ kind: "error", text: res.error === "not_found" ? copy.refund.errors.not_found : copy.sync.failed })
      }
    })
  }

  const onReview = (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)
    setAmountError(null)
    if (amount.trim() === "") return setConfirmMinor(refundableMinor)
    const p = parseMajorAmount(amount, exponent)
    if (!p.ok) return setAmountError(copy.refund.errors[p.error])
    if (p.minor > refundableMinor) return setAmountError(copy.refund.errors.exceeds)
    setConfirmMinor(p.minor)
  }

  const onConfirm = () => {
    setConfirmMinor(null)
    startRefund(async () => {
      const res = await refundPaymentAction({ paymentId, amount, expectedRefundedMinor: refundedMinor })
      if (res.ok) {
        setRequested(true)
        setAmount("")
        setNotice({ kind: "success", text: copy.refund.done })
        router.refresh()
      } else {
        setNotice({ kind: "error", text: refundErrorText(res.error) })
      }
    })
  }

  const refundable = status === "approved" && refundableMinor > 0
  const errorId = "payments-admin-amount-error"
  const helpId = "payments-admin-amount-help"

  return (
    <div className="flex flex-col gap-6">
      {notice && <FormAlert variant={notice.kind === "success" ? "success" : "destructive"}>{notice.text}</FormAlert>}

      <div>
        <SubmitButton
          type="button"
          variant="outline"
          pending={syncing}
          label={copy.sync.label}
          pendingLabel={copy.sync.pending}
          onClick={onSync}
          disabled={refunding}
        />
      </div>

      <section className="flex flex-col gap-3 border-t pt-6" aria-labelledby="payments-admin-refund-title">
        <div className="flex flex-col gap-1">
          <h3 id="payments-admin-refund-title" className="text-base font-medium">
            {copy.refund.title}
          </h3>
          <p className="text-sm text-muted-foreground">{copy.refund.description}</p>
        </div>

        {!canRefund ? (
          <p className="text-sm text-muted-foreground">{copy.refund.noPermission}</p>
        ) : !refundable ? (
          <p className="text-sm text-muted-foreground">{copy.refund.notAvailable}</p>
        ) : requested ? (
          <p className="text-sm text-muted-foreground" role="status">
            {copy.refund.requested}
          </p>
        ) : (
          <form onSubmit={onReview} className="flex flex-col gap-3 sm:max-w-sm" noValidate>
            <Field data-invalid={amountError ? true : undefined}>
              <FieldLabel htmlFor="payments-admin-amount">{copy.refund.amountLabel(currency)}</FieldLabel>
              <Input
                id="payments-admin-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                readOnly={refunding}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={describedBy(helpId, amountError && errorId)}
              />
              <FieldDescription id={helpId}>{copy.refund.amountHelp(money(refundableMinor))}</FieldDescription>
              {amountError && <FieldError id={errorId}>{amountError}</FieldError>}
            </Field>
            <div>
              <SubmitButton
                variant="destructive"
                pending={refunding}
                label={copy.refund.submit}
                pendingLabel={copy.refund.pending}
                disabled={syncing}
              />
            </div>
          </form>
        )}
      </section>

      <AlertDialog open={confirmMinor !== null} onOpenChange={(open) => !open && setConfirmMinor(null)}>
        <AlertDialogContent>
          {confirmMinor !== null && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{copy.refund.confirmTitle(money(confirmMinor))}</AlertDialogTitle>
                <AlertDialogDescription>
                  {copy.refund.confirmDescription(money(confirmMinor), orderId)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{copy.refund.cancel}</AlertDialogCancel>
                <Button variant="destructive" onClick={onConfirm}>
                  {copy.refund.confirm}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
