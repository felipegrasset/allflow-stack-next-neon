import type { Metadata } from "next"

import { ButtonLink } from "@/components/button-link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { resolveReturnLookup, returnOutcome, safeInternalPath, type SearchParams } from "../server/logic"
import { reconcileReturn } from "../server/return"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.return.title, robots: { index: false, follow: false } }
}

/**
 * /pago/retorno — public. Where the person lands after the provider's
 * checkout (build the URL with `paymentReturnPath()` of contracts/). It
 * reconciles the payment with the provider and says, in one sentence, how it
 * went. It shows no amount, id or reason: anyone with the link sees it.
 *
 * It does NOT fulfil anything. The app fulfils when
 * `getPaymentByOrder(id)?.status === "approved"` on its own server code.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [sp, copy] = await Promise.all([searchParams, getModuleCopy(es)])
  const lookup = resolveReturnLookup(sp)
  const { found, status } = await reconcileReturn(lookup)
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next
  const next = safeInternalPath(nextRaw)
  const outcome = returnOutcome(status)
  const message = found ? copy.return[outcome] : copy.return.notFound

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md" data-testid="payment-return" data-outcome={found ? outcome : "not_found"}>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">{copy.return.title}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p role="status">{message}</p>
          <div>
            <ButtonLink href={next}>{copy.return.back}</ButtonLink>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
