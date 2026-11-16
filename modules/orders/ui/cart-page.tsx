import type { Metadata } from "next"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { FormAlert } from "@/components/form-alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getItem, getSellableItems, itemPublicPath } from "@/modules/catalog/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { quoteCart } from "../contracts/domain"
import { es } from "../messages"
import { readCart } from "../server/cart"
import { CartLineControls, RemoveUnavailable } from "./cart-controls"
import { asLocale, formatMoney } from "./format"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.cart.title, robots: { index: false, follow: false } }
}

/**
 * /carrito — public (no account needed to fill a cart). Prices shown are read
 * from catalog NOW; they are a preview: the order re-prices under a lock.
 */
export default async function CartPage() {
  const [copy, locale, cart] = await Promise.all([getModuleCopy(es), getLocale().then(asLocale), readCart()])
  const items = await getSellableItems(cart.map((l) => l.itemId))
  const byId = new Map(items.map((i) => [i.id, i]))
  const missing = cart.filter((l) => !byId.has(l.itemId))
  const missingNames = new Map(
    await Promise.all(missing.map(async (l) => [l.itemId, (await getItem(l.itemId))?.name ?? null] as const))
  )
  const quote = quoteCart(cart, items)

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.cart.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.cart.subtitle}</p>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">{copy.cart.empty}</p>
          <ButtonLink href="/productos" variant="outline">
            {copy.cart.browse}
          </ButtonLink>
        </div>
      ) : (
        <>
          <section aria-label={copy.cart.listLabel}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.cart.product}</TableHead>
                  <TableHead className="hidden sm:table-cell">{copy.cart.price}</TableHead>
                  <TableHead>{copy.cart.qty}</TableHead>
                  <TableHead className="text-right">{copy.cart.lineTotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((l) => {
                  const item = byId.get(l.itemId)
                  const name = item?.name ?? missingNames.get(l.itemId) ?? copy.cart.unavailableItem
                  return (
                    <TableRow key={l.itemId}>
                      <TableCell className="font-medium">
                        {item ? (
                          <a href={itemPublicPath(item.slug)} className="underline-offset-2 hover:underline">
                            {name}
                          </a>
                        ) : (
                          <span className="flex flex-col">
                            <span>{name}</span>
                            <span className="text-xs text-destructive">{copy.cart.unavailableItem}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {item ? formatMoney(item.priceMinor, item.currency, locale) : "—"}
                      </TableCell>
                      <TableCell>
                        <CartLineControls itemId={l.itemId} qty={l.qty} name={name} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item && Number.isSafeInteger(item.priceMinor * l.qty)
                          ? formatMoney(item.priceMinor * l.qty, item.currency, locale)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </section>

          {!quote.ok && quote.reason === "unavailable" ? (
            <div className="flex flex-col gap-2">
              <FormAlert>{copy.cart.unavailable}</FormAlert>
              <RemoveUnavailable />
            </div>
          ) : null}
          {!quote.ok && quote.reason === "mixed_currency" ? <FormAlert>{copy.cart.mixedCurrency}</FormAlert> : null}
          {!quote.ok && quote.reason === "too_large" ? <FormAlert>{copy.cart.tooLarge}</FormAlert> : null}

          {quote.ok ? (
            <div className="flex flex-col items-end gap-3">
              <p className="text-base">
                <span className="text-muted-foreground">{copy.cart.subtotal}: </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(quote.quote.subtotalMinor, quote.quote.currency, locale)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{copy.cart.note}</p>
              <ButtonLink href="/checkout">{copy.cart.checkout}</ButtonLink>
            </div>
          ) : null}
        </>
      )}
    </main>
  )
}
