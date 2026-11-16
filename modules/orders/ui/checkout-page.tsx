import type { Metadata } from "next"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { FormAlert } from "@/components/form-alert"
import { getSellableItems } from "@/modules/catalog/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { quoteCart } from "../contracts/domain"
import { es } from "../messages"
import { readCart } from "../server/cart"
import { ordersTtlMinutes } from "../server/config"
import { requirePagePermission } from "../server/guard"
import { asLocale } from "./format"
import { OrderLines } from "./order-lines"
import { PlaceOrder } from "./place-order"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.checkout.title }
}

/** /checkout — signed in with `order:read`. Shows the server-computed total and places the order. */
export default async function CheckoutPage() {
  await requirePagePermission("/checkout", "read")
  const [copy, locale, cart] = await Promise.all([getModuleCopy(es), getLocale().then(asLocale), readCart()])
  const quote = quoteCart(cart, await getSellableItems(cart.map((l) => l.itemId)))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.checkout.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.checkout.subtitle}</p>
      </div>
      {quote.ok ? (
        <>
          <OrderLines
            lines={quote.quote.lines.map((l) => ({ key: l.itemId, ...l }))}
            currency={quote.quote.currency}
            locale={locale}
            labels={{
              product: copy.cart.product,
              unitPrice: copy.detail.unitPrice,
              qty: copy.cart.qty,
              lineTotal: copy.cart.lineTotal,
              subtotal: copy.detail.subtotal,
              total: copy.detail.total,
              caption: copy.detail.items,
            }}
            subtotalMinor={quote.quote.subtotalMinor}
            totalMinor={quote.quote.subtotalMinor}
          />
          <p className="text-sm text-muted-foreground">{copy.checkout.reserveNote(ordersTtlMinutes())}</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ButtonLink href="/carrito" variant="outline">
              {copy.checkout.back}
            </ButtonLink>
            <PlaceOrder expectedSubtotalMinor={quote.quote.subtotalMinor} currency={quote.quote.currency} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <FormAlert>
            {quote.reason === "empty"
              ? copy.cart.empty
              : quote.reason === "mixed_currency"
                ? copy.cart.mixedCurrency
                : quote.reason === "too_large"
                  ? copy.cart.tooLarge
                  : copy.cart.unavailable}
          </FormAlert>
          <div>
            <ButtonLink href="/carrito" variant="outline">
              {copy.checkout.back}
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  )
}
