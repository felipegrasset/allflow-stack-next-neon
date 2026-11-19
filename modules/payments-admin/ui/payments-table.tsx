import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime, type Locale } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { minorToMajor, type PaymentRecord } from "@/modules/payments/contracts"

import { paymentDetailHref } from "../contracts"
import { es } from "../messages"
import { statusVariant } from "../server/logic"

/** A page of payments. Ids, amounts, dates and states only: no payer or provider data. */
export async function PaymentsTable({
  items,
  locale,
  caption,
  testId,
}: {
  items: PaymentRecord[]
  locale: Locale
  caption: string
  testId?: string
}) {
  const copy = await getModuleCopy(es)
  const l = copy.list
  return (
    <div className="rounded-xl border" data-testid={testId}>
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{l.colCreated}</TableHead>
            <TableHead>{l.colOrder}</TableHead>
            <TableHead>{l.colProvider}</TableHead>
            <TableHead>{l.colStatus}</TableHead>
            <TableHead className="text-right">{l.colAmount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id} data-testid="payment-row" data-status={p.status}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(p.createdAt, locale)}
              </TableCell>
              <TableCell className="max-w-48 truncate">
                <Link
                  href={paymentDetailHref(p.id)}
                  className="font-medium underline-offset-4 hover:underline"
                  aria-label={l.open(p.orderId)}
                >
                  {p.orderId}
                </Link>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {copy.providers[p.provider]}
                  {p.environment === "sandbox" && <Badge variant="outline">{copy.environments.sandbox}</Badge>}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(p.status)}>{copy.statuses[p.status]}</Badge>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {formatCurrency(minorToMajor(p.amountMinor, p.currency), p.currency, locale)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
