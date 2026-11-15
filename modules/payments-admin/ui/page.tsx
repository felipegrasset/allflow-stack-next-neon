import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { FormAlert } from "@/components/form-alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { describedBy } from "@/lib/forms"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import {
  getPaymentByOrder,
  InvalidCursorError,
  listPayments,
  type PaymentsPage,
} from "@/modules/payments/contracts"

import { PAYMENTS_ADMIN_PATH, paymentDetailHref } from "../contracts"
import { es } from "../messages"
import { requirePaymentPermission } from "../server/access"
import { currentLocale } from "../server/locale"
import {
  FILTER_ENVIRONMENTS,
  FILTER_PROVIDERS,
  FILTER_STATUSES,
  listHref,
  ORDER_ID_MAX,
  parseListParams,
  type ListFilters,
  type SearchParams,
} from "../server/logic"
import { PaymentsTable } from "./payments-table"

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getModuleCopy(es)
  return { title: copy.title }
}

const QUEUE_LIMIT = 10

/**
 * /admin/payments — admins with `payment:read`.
 *
 * - `?order=<id>`: lookup by order → redirects to that payment's detail.
 * - The `needs_review` queue first (first page, unless the list is already
 *   filtered to it).
 * - Every payment, newest first, filtered by status / provider / environment,
 *   paged with `listPayments`' cursor (forward only). A cursor that is not
 *   valid any more falls back to the first page.
 */
export default async function PaymentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePaymentPermission("read")
  const [sp, copy, locale] = await Promise.all([searchParams, getModuleCopy(es), currentLocale()])

  // ── lookup by order ────────────────────────────────────────────────────────
  const rawOrder = Array.isArray(sp.order) ? sp.order[0] : sp.order
  const order = rawOrder?.trim() ?? ""
  const orderInvalid = rawOrder !== undefined && (order.length === 0 || order.length > ORDER_ID_MAX)
  let orderNotFound = false
  if (order && !orderInvalid) {
    const found = await getPaymentByOrder(order)
    if (found) redirect(paymentDetailHref(found.id))
    orderNotFound = true
  }

  // ── list ───────────────────────────────────────────────────────────────────
  const { filters, cursor } = parseListParams(sp)
  let page: PaymentsPage
  let cursorReset = false
  try {
    page = await listPayments({ ...filters, cursor })
  } catch (e) {
    if (!(e instanceof InvalidCursorError)) throw e
    cursorReset = true
    page = await listPayments(filters)
  }
  const onFirstPage = !cursor || cursorReset
  const queue =
    onFirstPage && filters.status !== "needs_review"
      ? await listPayments({ status: "needs_review", limit: QUEUE_LIMIT })
      : null
  const filtered = Object.keys(filters).length > 0

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      {queue && queue.items.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="payments-admin-queue">
          <div className="flex flex-col gap-1">
            <h2 id="payments-admin-queue" className="text-lg font-semibold">
              {copy.queue.title}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.queue.description}</p>
          </div>
          <PaymentsTable items={queue.items} locale={locale} caption={copy.queue.title} testId="payments-admin-queue" />
          {queue.nextCursor && (
            <div>
              <ButtonLink variant="outline" size="sm" href={listHref(PAYMENTS_ADMIN_PATH, { status: "needs_review" })}>
                {copy.queue.viewAll}
              </ButtonLink>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="payments-admin-search">
        <h2 id="payments-admin-search" className="text-lg font-semibold">
          {copy.search.title}
        </h2>
        <form method="get" action={PAYMENTS_ADMIN_PATH} className="flex flex-col gap-2 sm:max-w-md">
          <Field data-invalid={orderInvalid || undefined}>
            <FieldLabel htmlFor="payments-admin-order">{copy.search.label}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="payments-admin-order"
                name="order"
                defaultValue={order}
                maxLength={ORDER_ID_MAX}
                autoComplete="off"
                aria-invalid={orderInvalid || undefined}
                aria-describedby={describedBy("payments-admin-order-help", orderInvalid && "payments-admin-order-error")}
              />
              <Button type="submit">{copy.search.submit}</Button>
            </div>
            <FieldDescription id="payments-admin-order-help">{copy.search.help}</FieldDescription>
            {orderInvalid && <FieldError id="payments-admin-order-error">{copy.search.invalid}</FieldError>}
          </Field>
        </form>
        {orderNotFound && (
          <Empty className="border" data-testid="payments-admin-not-found">
            <EmptyHeader>
              <EmptyTitle>
                <h3 className="text-base font-medium">{copy.notFound.title}</h3>
              </EmptyTitle>
              <EmptyDescription>{copy.notFound.description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="payments-admin-list">
        <h2 id="payments-admin-list" className="text-lg font-semibold">
          {copy.list.title}
        </h2>
        <FiltersForm filters={filters} copy={copy} />
        {cursorReset && <FormAlert>{copy.list.cursorReset}</FormAlert>}
        {page.items.length === 0 ? (
          <Empty className="border" data-testid="payments-admin-empty">
            <EmptyHeader>
              <EmptyDescription>{copy.list.empty}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <PaymentsTable items={page.items} locale={locale} caption={copy.list.caption} testId="payments-admin-list" />
        )}
        <div className="flex flex-wrap gap-2">
          {!onFirstPage && (
            <ButtonLink variant="outline" size="sm" href={listHref(PAYMENTS_ADMIN_PATH, filters)}>
              {copy.list.first}
            </ButtonLink>
          )}
          {page.nextCursor && (
            <ButtonLink variant="outline" size="sm" href={listHref(PAYMENTS_ADMIN_PATH, filters, page.nextCursor)}>
              {copy.list.next}
            </ButtonLink>
          )}
          {filtered && (
            <ButtonLink variant="ghost" size="sm" href={PAYMENTS_ADMIN_PATH}>
              {copy.list.clear}
            </ButtonLink>
          )}
        </div>
      </section>
    </div>
  )
}

type Copy = Awaited<ReturnType<typeof getModuleCopy<typeof es>>>

/** A plain GET form: the filters live in the URL (shareable, back button works). */
function FiltersForm({ filters, copy }: { filters: ListFilters; copy: Copy }) {
  const l = copy.list
  const select = (
    name: keyof ListFilters,
    label: string,
    options: readonly { value: string; label: string }[]
  ) => (
    <Field className="w-auto">
      <FieldLabel htmlFor={`payments-admin-filter-${name}`}>{label}</FieldLabel>
      <NativeSelect id={`payments-admin-filter-${name}`} name={name} defaultValue={filters[name] ?? ""}>
        <NativeSelectOption value="">{l.all}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
  return (
    <form method="get" action={PAYMENTS_ADMIN_PATH} aria-label={l.filters} className="flex flex-wrap items-end gap-3">
      {select("status", l.status, FILTER_STATUSES.map((s) => ({ value: s, label: copy.statuses[s] })))}
      {select("provider", l.provider, FILTER_PROVIDERS.map((p) => ({ value: p, label: copy.providers[p] })))}
      {select("environment", l.environment, FILTER_ENVIRONMENTS.map((e) => ({ value: e, label: copy.environments[e] })))}
      <Button type="submit" variant="secondary">
        {l.apply}
      </Button>
    </form>
  )
}
