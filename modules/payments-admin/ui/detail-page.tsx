import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getPayment } from "@/modules/payments/contracts"

import { PAYMENTS_ADMIN_PATH } from "../contracts"
import { es } from "../messages"
import { hasPaymentPermission, requirePaymentPermission } from "../server/access"
import { currentLocale } from "../server/locale"
import { PaymentDetail } from "./payment-detail"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.title }
}

/**
 * /admin/payments/[id] — one payment (`getPayment`: what the database has,
 * without asking the provider), with "check with the provider" and refund.
 */
export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePaymentPermission("read")
  const [{ id }, copy, locale, canRefund] = await Promise.all([
    params,
    getModuleCopy(es),
    currentLocale(),
    hasPaymentPermission("refund"),
  ])
  const record = await getPayment(id)
  if (!record) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={PAYMENTS_ADMIN_PATH}>
          {copy.back}
        </ButtonLink>
      </div>
      <PaymentDetail record={record} locale={locale} canRefund={canRefund} />
    </div>
  )
}
