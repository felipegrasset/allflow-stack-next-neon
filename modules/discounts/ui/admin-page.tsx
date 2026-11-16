import Link from "next/link"
import { forbidden } from "next/navigation"
import { getLocale } from "next-intl/server"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatAmountInput } from "@/modules/catalog/contracts/money"
import { formatDateTime, type Locale } from "@/modules/i18n/contracts"
import { getModuleCopy, type ModuleCopy } from "@/modules/i18n/contracts/server"
import { shortOrderRef } from "@/modules/orders/contracts"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { codeState, formatPercent, type CodeState } from "../contracts/domain"
import type { DiscountCode, DiscountCodeWithUses, Redemption } from "../contracts/types"
import { es } from "../messages"
import { canManageDiscounts } from "../server/authz"
import { ADMIN_PATH, orderPagePath } from "../server/paths"
import * as store from "../server/store"
import { ActiveToggle } from "./code-form"
import { CodeFormLoader } from "./code-form-loader"
import { EMPTY_CODE_FORM, type CodeFormValues } from "./code-form-values"
import { asLocale, formatMoney, one } from "./money"

type SearchParams = Promise<{ id?: string | string[]; new?: string | string[] }>
type Copy = ModuleCopy<typeof es>

const STATE_VARIANT: Record<CodeState, "secondary" | "outline"> = {
  active: "secondary",
  scheduled: "outline",
  inactive: "outline",
  ended: "outline",
  exhausted: "outline",
}

/** Server-only clock read, outside the render body. */
function nowDate(): Date {
  return new Date()
}

/**
 * /admin/discounts — the discount codes. Needs `discount:manage` (checked
 * here; the /admin layout is only the door). `?id=<code>` edits a code and
 * lists its recent uses, `?new=1` creates one.
 */
export default async function DiscountsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOnboardedUser(ADMIN_PATH)
  if (!(await canManageDiscounts())) forbidden()
  const sp = await searchParams
  const id = one(sp.id).slice(0, 100)
  const creating = one(sp.new) === "1"
  const db = getKysely()
  const [copy, locale, codes] = await Promise.all([getModuleCopy(es), getLocale().then(asLocale), store.listCodes(db)])
  const a = copy.admin
  const now = nowDate()
  const selected = codes.find((c) => c.id === id) ?? null
  const uses = selected ? await store.listRedemptions(db, selected.id) : []
  const href = (params: Record<string, string>) => `${ADMIN_PATH}?${new URLSearchParams(params).toString()}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-xl font-semibold">{a.title}</h1>
          <p className="text-sm text-muted-foreground">{a.subtitle}</p>
          <p className="text-sm text-muted-foreground">{a.rounding}</p>
        </div>
        <ButtonLink href={href({ new: "1" })} size="sm">
          {a.newLink}
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="flex flex-col gap-3" aria-labelledby="discounts-admin-list">
          <h2 id="discounts-admin-list" className="text-base font-medium">
            {a.listTitle}
          </h2>
          {codes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {a.empty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {codes.map((c) => {
                const state = codeState(c, c.activeUses, now)
                return (
                  <li key={c.id}>
                    <Link
                      href={href({ id: c.id })}
                      aria-current={c.id === selected?.id ? "true" : undefined}
                      className="flex flex-col gap-1 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <code className="text-sm font-medium">{c.code}</code>
                        <Badge variant={STATE_VARIANT[state]}>{a.states[state]}</Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">{summary(c, copy, locale)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6" aria-label={selected ? a.editTitle : a.newTitle}>
          {selected ? (
            <Selected code={selected} uses={uses} copy={copy} locale={locale} />
          ) : creating || codes.length === 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="discounts-admin-new">
              <h2 id="discounts-admin-new" className="text-base font-medium">
                {a.newTitle}
              </h2>
              <CodeFormLoader initial={EMPTY_CODE_FORM} />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">{a.selectHint}</p>
          )}
        </aside>
      </div>
    </div>
  )
}

/** "10 % · 3 of 50 uses · 1 per person · minimum $15.000 · until …" */
function summary(c: DiscountCodeWithUses, copy: Copy, locale: Locale): string {
  const a = copy.admin
  const parts = [
    c.kind === "percent"
      ? a.percentValue(formatPercent(c.percentBp ?? 0))
      : formatMoney(c.amountMinor ?? 0, c.currency ?? "USD", locale),
    c.maxUses === null ? a.usesUnlimited(String(c.activeUses)) : a.uses(String(c.activeUses), String(c.maxUses)),
  ]
  if (c.maxUsesPerUser !== null) parts.push(a.perUser(String(c.maxUsesPerUser)))
  if (c.minSubtotalMinor !== null && c.currency) parts.push(a.minSubtotal(formatMoney(c.minSubtotalMinor, c.currency, locale)))
  if (c.startsAt) parts.push(a.from(formatDateTime(c.startsAt, locale)))
  if (c.endsAt) parts.push(a.until(formatDateTime(c.endsAt, locale)))
  return parts.join(" · ")
}

function formValues(c: DiscountCode): CodeFormValues {
  return {
    code: c.code,
    kind: c.kind,
    percent: c.percentBp === null ? "" : formatPercent(c.percentBp),
    amount: c.amountMinor === null || !c.currency ? "" : formatAmountInput(c.amountMinor, c.currency),
    currency: c.currency ?? "",
    minSubtotal: c.minSubtotalMinor === null || !c.currency ? "" : formatAmountInput(c.minSubtotalMinor, c.currency),
    startsAt: c.startsAt ? c.startsAt.toISOString() : "",
    endsAt: c.endsAt ? c.endsAt.toISOString() : "",
    maxUses: c.maxUses === null ? "" : String(c.maxUses),
    maxUsesPerUser: c.maxUsesPerUser === null ? "" : String(c.maxUsesPerUser),
    note: c.note ?? "",
  }
}

function Selected({ code, uses, copy, locale }: { code: DiscountCodeWithUses; uses: Redemption[]; copy: Copy; locale: Locale }) {
  const a = copy.admin
  return (
    <>
      <section className="flex flex-col gap-2" aria-labelledby="discounts-admin-status">
        <h2 id="discounts-admin-status" className="flex flex-wrap items-center gap-2 text-base font-medium">
          <code>{code.code}</code>
        </h2>
        <p className="text-sm text-muted-foreground">{summary(code, copy, locale)}</p>
        {code.note ? <p className="text-sm">{code.note}</p> : null}
        <h3 className="text-sm font-medium">{a.statusTitle}</h3>
        <ActiveToggle key={`${code.id}-${code.active}`} codeId={code.id} active={code.active} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="discounts-admin-edit">
        <h3 id="discounts-admin-edit" className="text-sm font-medium">
          {a.editTitle}
        </h3>
        <p className="text-sm text-muted-foreground">{a.editHint}</p>
        <CodeFormLoader key={`${code.id}-${code.updatedAt.getTime()}`} codeId={code.id} initial={formValues(code)} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="discounts-admin-uses">
        <h3 id="discounts-admin-uses" className="text-sm font-medium">
          {a.usesTitle}
        </h3>
        <p className="text-sm text-muted-foreground">{a.usesHint}</p>
        {uses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{a.usesEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{a.columns.order}</TableHead>
                <TableHead className="text-right">{a.columns.amount}</TableHead>
                <TableHead>{a.columns.date}</TableHead>
                <TableHead>{a.columns.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uses.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={orderPagePath(u.orderId)} className="font-mono text-primary underline-offset-4 hover:underline">
                      {shortOrderRef(u.orderId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(u.amountMinor, u.currency, locale)}</TableCell>
                  <TableCell>{formatDateTime(u.createdAt, locale)}</TableCell>
                  <TableCell>
                    {u.releasedAt
                      ? `${a.useStatus.released} (${u.releaseReason ? a.releaseReasons[u.releaseReason] : ""})`
                      : u.confirmedAt
                        ? a.useStatus.confirmed
                        : a.useStatus.active}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}
