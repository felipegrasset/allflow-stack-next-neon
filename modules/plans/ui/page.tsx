import Link from "next/link"

import { FormAlert } from "@/components/form-alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { getPlan } from "../contracts"
import {
  canChangeTo,
  canStartSubscription,
  pendingRequest,
  planDescription,
  planName,
  planPriceNote,
  subscriptionOptions,
} from "../contracts/domain"
import { es } from "../messages"
import { canManagePlans } from "../server/authz"
import { ADMIN_PATH, SETTINGS_PATH } from "../server/paths"
import * as store from "../server/store"
import { subjectOf } from "../server/subject"
import { EntitlementList } from "./entitlement-list"
import { activeLocale } from "./locale"
import { CancelSubscriptionButton, ChangePlanButton } from "./plan-actions"
import { SubscribeButton } from "./subscribe-button"

const STATUS_KEYS = ["pending", "active", "past_due", "canceled"] as const
type StatusKey = (typeof STATUS_KEYS)[number]
const isStatusKey = (s: string): s is StatusKey => (STATUS_KEYS as readonly string[]).includes(s)

const PROVIDER_KEYS = ["paddle", "mercadopago", "flow"] as const
type ProviderKey = (typeof PROVIDER_KEYS)[number]
const isProviderKey = (s: string | null): s is ProviderKey =>
  s !== null && (PROVIDER_KEYS as readonly string[]).includes(s)

/**
 * /settings/plan — the signed-in subject's plan (anyone with a session): what
 * it includes, the plans for sale, and switching or canceling the live
 * subscription. The plan shown is ALWAYS what payments' getActiveSubscription
 * says; a change or cancel asked for here shows as "requested" until the
 * provider confirms it. The catalog editor lives at /admin/plans.
 */
export default async function PlanSettingsPage() {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  const subject = subjectOf(session)
  const db = getKysely()
  const [copy, locale, resolution, manager, forSale, request] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    getPlan(subject),
    canManagePlans(),
    store.listPlans(db, { scope: "published" }),
    store.getRequest(db, subject),
  ])
  const sub = resolution.subscription
  const opts = subscriptionOptions(sub)
  const waiting = pendingRequest(request, sub, new Date())
  const others = forSale.filter((p) => p.id !== resolution.plan?.id)
  const statusText = sub ? copy.current.statuses[isStatusKey(sub.status) ? sub.status : "other"] : null
  const providerId = sub?.provider ?? null
  const providerName = copy.providers[isProviderKey(providerId) ? providerId : "other"]
  const periodEndLabel = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd, locale, "long") : null
  const waitingPlan = waiting?.toPlanId
    ? (forSale.find((p) => p.id === waiting.toPlanId) ?? (await store.findPlanById(db, waiting.toPlanId)))
    : null

  const modeText =
    opts.mode === "past_due"
      ? copy.modes.past_due
      : opts.mode === "ending"
        ? copy.modes.ending
        : opts.mode === "unsupported"
          ? copy.modes.unsupported(providerName)
          : opts.mode === "cancel_scheduled"
            ? copy.modes.cancel_scheduled
            : null

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="plans-current">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 id="plans-current" className="text-xl font-semibold">
              {copy.title}
            </h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          {manager ? (
            <Link href={ADMIN_PATH} className="text-sm text-primary underline-offset-4 hover:underline">
              {copy.manageLink}
            </Link>
          ) : null}
        </div>
        {resolution.unmappedPlanRef ? <FormAlert>{copy.current.unmapped}</FormAlert> : null}
        {waiting ? (
          <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
            {waiting.kind === "change"
              ? copy.request.change(waitingPlan ? planName(waitingPlan, locale) : copy.request.otherPlan)
              : copy.request.cancel}
          </p>
        ) : null}
        {resolution.plan ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {planName(resolution.plan, locale)}
                <Badge variant="secondary">
                  {resolution.source === "subscription"
                    ? copy.current.sourceSubscription
                    : copy.current.sourceDefault}
                </Badge>
              </CardTitle>
              {planDescription(resolution.plan, locale) ? (
                <CardDescription>{planDescription(resolution.plan, locale)}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {statusText ? (
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>{copy.current.status(statusText)}</p>
                  {sub?.cancelAt ? (
                    <p>{copy.current.cancelAt(formatDate(sub.cancelAt, locale, "long"))}</p>
                  ) : periodEndLabel ? (
                    <p>{copy.current.periodEnd(periodEndLabel)}</p>
                  ) : null}
                </div>
              ) : null}
              <h2 className="text-sm font-medium">{copy.entitlements.title}</h2>
              <EntitlementList entitlements={resolution.plan.entitlements} copy={copy} locale={locale} />
              {modeText ? <p className="text-sm text-muted-foreground">{modeText}</p> : null}
              {opts.canCancel && !waiting ? <CancelSubscriptionButton periodEndLabel={periodEndLabel} /> : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{copy.current.none}</CardTitle>
              <CardDescription>{copy.current.noneHint}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="plans-catalog">
        <div className="flex flex-col gap-1">
          <h2 id="plans-catalog" className="text-base font-medium">
            {copy.catalog.title}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.catalog.subtitle}</p>
        </div>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.catalog.empty}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {others.map((p) => {
              const note = planPriceNote(p, locale)
              return (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle>{planName(p, locale)}</CardTitle>
                    {planDescription(p, locale) ? (
                      <CardDescription>{planDescription(p, locale)}</CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {note ? <p className="text-sm font-medium">{copy.catalog.priceNote(note)}</p> : null}
                    <EntitlementList entitlements={p.entitlements} copy={copy} locale={locale} />
                    {waiting ? null : canChangeTo(resolution, p) ? (
                      <ChangePlanButton
                        planId={p.id}
                        planLabel={planName(p, locale)}
                        provider={sub?.provider ?? null}
                      />
                    ) : canStartSubscription(resolution, p) ? (
                      <SubscribeButton planId={p.id} />
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
