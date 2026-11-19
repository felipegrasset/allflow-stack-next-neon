import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDateTime, type Locale } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { currencyExponent, minorToMajor, type PaymentRecord } from "@/modules/payments/contracts"

import { es } from "../messages"
import { refundableMinor, statusVariant } from "../server/logic"
import { PaymentActions } from "./payment-actions"

/**
 * One payment, as `payments` stores it. Shows ids, amounts, dates and states:
 * never card data, payer data or anything the provider sent (the record has
 * none of it on purpose).
 */
export async function PaymentDetail({
  record,
  locale,
  canRefund,
}: {
  record: PaymentRecord
  locale: Locale
  canRefund: boolean
}) {
  const copy = await getModuleCopy(es)
  const d = copy.detail
  const money = (minor: number) => formatCurrency(minorToMajor(minor, record.currency), record.currency, locale)
  const left = refundableMinor(record)

  const rows: [string, React.ReactNode][] = [
    [d.paymentId, <code key="id" className="text-xs break-all">{record.id}</code>],
    [d.provider, copy.providers[record.provider]],
    [
      d.providerRef,
      record.providerPaymentId ? (
        <code key="ref" className="text-xs break-all">{record.providerPaymentId}</code>
      ) : (
        d.none
      ),
    ],
    [d.environment, copy.environments[record.environment]],
    [d.amount, money(record.amountMinor)],
    [d.refunded, money(record.refundedMinor)],
    [d.refundable, money(left)],
    [d.created, formatDateTime(record.createdAt, locale)],
    [d.approved, record.approvedAt ? formatDateTime(record.approvedAt, locale) : d.none],
  ]

  return (
    <Card data-testid="payments-admin-detail" data-status={record.status}>
      <CardHeader>
        <CardTitle>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {d.title(record.orderId)}
            <Badge variant={statusVariant(record.status)}>{copy.statuses[record.status]}</Badge>
            {record.environment === "sandbox" && <Badge variant="outline">{copy.environments.sandbox}</Badge>}
          </h2>
        </CardTitle>
        <CardDescription>{copy.statusHelp[record.status]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {record.status === "needs_review" && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>{copy.statusHelp.needs_review}</AlertDescription>
          </Alert>
        )}
        {record.environment === "sandbox" && (
          <p className="text-sm text-muted-foreground">{copy.sandboxNote}</p>
        )}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        <PaymentActions
          orderId={record.orderId}
          paymentId={record.id}
          status={record.status}
          currency={record.currency}
          exponent={currencyExponent(record.currency)}
          refundedMinor={record.refundedMinor}
          refundableMinor={left}
          canRefund={canRefund}
        />
      </CardContent>
    </Card>
  )
}
