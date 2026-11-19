import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Locale } from "@/modules/i18n/contracts"

import { formatMoney } from "./format"

export type LineView = { key: string; name: string; sku: string | null; unitPriceMinor: number; qty: number; lineTotalMinor: number }

/** Lines and totals of a quote or an order (server component; amounts already computed on the server). */
export function OrderLines({
  lines,
  currency,
  locale,
  labels,
  subtotalMinor,
  discount,
  totalMinor,
}: {
  lines: LineView[]
  currency: string
  locale: Locale
  labels: { product: string; unitPrice: string; qty: string; lineTotal: string; subtotal: string; total: string; caption: string }
  subtotalMinor: number
  discount?: { label: string; amountMinor: number } | null
  totalMinor: number
}) {
  return (
    <Table>
      <caption className="sr-only">{labels.caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{labels.product}</TableHead>
          <TableHead className="hidden sm:table-cell">{labels.unitPrice}</TableHead>
          <TableHead className="text-right">{labels.qty}</TableHead>
          <TableHead className="text-right">{labels.lineTotal}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.key}>
            <TableCell className="font-medium">
              {l.name}
              {l.sku ? <span className="block text-xs text-muted-foreground">{l.sku}</span> : null}
            </TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">{formatMoney(l.unitPriceMinor, currency, locale)}</TableCell>
            <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(l.lineTotalMinor, currency, locale)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        {discount && discount.amountMinor > 0 ? (
          <>
            <TableRow>
              <TableCell colSpan={3}>{labels.subtotal}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(subtotalMinor, currency, locale)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3}>{discount.label}</TableCell>
              <TableCell className="text-right tabular-nums">−{formatMoney(discount.amountMinor, currency, locale)}</TableCell>
            </TableRow>
          </>
        ) : null}
        <TableRow>
          <TableCell colSpan={3} className="font-semibold">
            {labels.total}
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatMoney(totalMinor, currency, locale)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
