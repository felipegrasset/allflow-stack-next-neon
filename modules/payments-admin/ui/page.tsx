import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { describedBy } from "@/lib/forms"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getPaymentByOrder } from "@/modules/payments/contracts"

import { PAYMENTS_ADMIN_PATH } from "../contracts"
import { es } from "../messages"
import { hasPaymentPermission, requirePaymentPermission } from "../server/access"
import { currentLocale } from "../server/locale"
import { ORDER_ID_MAX, type SearchParams } from "../server/logic"
import { PaymentDetail } from "./payment-detail"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.title }
}

/**
 * /admin/payments?order=<id> — look up an order's payment, see it, check it
 * with the provider and refund it. Admins with `payment:read`; refunding also
 * needs `payment:refund`.
 *
 * v0.1 looks payments up BY ORDER only: `payments/contracts` has no list
 * function yet (see MODULE.md, «Límites conocidos»).
 */
export default async function PaymentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePaymentPermission("read")
  const [sp, copy, locale, canRefund] = await Promise.all([
    searchParams,
    getModuleCopy(es),
    currentLocale(),
    hasPaymentPermission("refund"),
  ])

  const raw = Array.isArray(sp.order) ? sp.order[0] : sp.order
  const order = raw?.trim() ?? ""
  const invalid = raw !== undefined && (order.length === 0 || order.length > ORDER_ID_MAX)
  const record = order && !invalid ? await getPaymentByOrder(order) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <form method="get" action={PAYMENTS_ADMIN_PATH} className="flex flex-col gap-2 sm:max-w-md">
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="payments-admin-order">{copy.search.label}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="payments-admin-order"
              name="order"
              defaultValue={order}
              maxLength={ORDER_ID_MAX}
              autoComplete="off"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy("payments-admin-order-help", invalid && "payments-admin-order-error")}
            />
            <Button type="submit">{copy.search.submit}</Button>
          </div>
          <FieldDescription id="payments-admin-order-help">{copy.search.help}</FieldDescription>
          {invalid && <FieldError id="payments-admin-order-error">{copy.search.invalid}</FieldError>}
        </Field>
      </form>

      {!order || invalid ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              <h2 className="text-base font-medium">{copy.empty.title}</h2>
            </EmptyTitle>
            <EmptyDescription>{copy.empty.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !record ? (
        <Empty className="border" data-testid="payments-admin-not-found">
          <EmptyHeader>
            <EmptyTitle>
              <h2 className="text-base font-medium">{copy.notFound.title}</h2>
            </EmptyTitle>
            <EmptyDescription>{copy.notFound.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PaymentDetail record={record} locale={locale} canRefund={canRefund} />
      )}
    </div>
  )
}
