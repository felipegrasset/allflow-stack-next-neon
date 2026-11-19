import Link from "next/link"
import { forbidden } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { formatNumber, type Locale } from "@/modules/i18n/contracts"
import { getModuleCopy, type ModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { entitlementLabel, planName, saleChecklist, type Plan } from "../contracts/domain"
import { es } from "../messages"
import { canManagePlans } from "../server/authz"
import { ADMIN_PATH } from "../server/paths"
import * as store from "../server/store"
import { activeLocale } from "./locale"
import { EntitlementForm, PlanForm, PlanStatusActions, RemoveEntitlementButton } from "./manage-plan"

type SearchParams = Promise<{ id?: string | string[]; new?: string | string[]; key?: string | string[] }>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/**
 * /admin/plans — the plan catalog editor. Needs `plan:manage` (checked here;
 * the /admin layout is only the door). `?id=<plan>` edits a plan,
 * `&key=<entitlement>` prefills the entitlement form, `?new=1` creates.
 * Shows, per plan, what it still needs before it can be sold.
 */
export default async function PlansAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOnboardedUser(ADMIN_PATH)
  if (!(await canManagePlans())) forbidden()
  const sp = await searchParams
  const id = one(sp.id).slice(0, 100)
  const entKey = one(sp.key).slice(0, 64)
  const creating = one(sp.new) === "1"
  const [copy, locale, plans] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    store.listPlans(getKysely(), { scope: "all" }),
  ])
  const m = copy.manage
  const selected = plans.find((p) => p.id === id) ?? null
  const knownKeys = [...new Set(plans.flatMap((p) => p.entitlements.map((e) => e.key)))].sort()
  const editing = selected?.entitlements.find((e) => e.key === entKey)
  const missingText = (p: Plan) =>
    saleChecklist(p)
      .missing.map((k) => m.checks[k])
      .join(" · ")
  const href = (params: Record<string, string>) => `${ADMIN_PATH}?${new URLSearchParams(params).toString()}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-xl font-semibold">{m.title}</h1>
          <p className="text-sm text-muted-foreground">{m.subtitle}</p>
          <p className="text-sm text-muted-foreground">{m.priceHint}</p>
        </div>
        <ButtonLink href={href({ new: "1" })} size="sm">
          {m.newLink}
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="flex flex-col gap-3" aria-labelledby="plans-admin-list">
          <h2 id="plans-admin-list" className="text-base font-medium">
            {m.listTitle}
          </h2>
          {plans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {m.empty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {plans.map((p) => {
                const check = saleChecklist(p)
                return (
                  <li key={p.id}>
                    <Link
                      href={href({ id: p.id })}
                      aria-current={p.id === selected?.id ? "true" : undefined}
                      className="flex flex-col gap-1 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{planName(p, locale)}</span>
                        <code className="text-xs text-muted-foreground">{p.key}</code>
                        {p.isDefault ? <Badge variant="secondary">{m.isDefault}</Badge> : null}
                        {!p.active ? (
                          <Badge variant="outline">{m.archived}</Badge>
                        ) : (
                          <Badge variant={p.published ? "secondary" : "outline"}>
                            {p.published ? m.published : m.draft}
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {check.sellable ? m.sellable : m.missingSummary(missingText(p))}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6" aria-label={selected ? m.editTitle : m.newTitle}>
          {selected ? (
            <SelectedPlan
              plan={selected}
              plans={plans}
              knownKeys={knownKeys}
              editing={editing ?? null}
              copy={copy}
              locale={locale}
              href={href}
            />
          ) : creating || plans.length === 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="plans-admin-new">
              <h2 id="plans-admin-new" className="text-base font-medium">
                {m.newTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{m.newHint}</p>
              <PlanForm />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">{m.selectHint}</p>
          )}
        </aside>
      </div>
    </div>
  )
}

type Copy = ModuleCopy<typeof es>

function SelectedPlan({
  plan,
  plans,
  knownKeys,
  editing,
  copy,
  locale,
  href,
}: {
  plan: Plan
  plans: Plan[]
  knownKeys: string[]
  editing: Plan["entitlements"][number] | null
  copy: Copy
  locale: Locale
  href: (params: Record<string, string>) => string
}) {
  const m = copy.manage
  const check = saleChecklist(plan)
  const label = planName(plan, locale)
  const replacements = plans
    .filter((p) => p.id !== plan.id && p.active)
    .map((p) => ({ id: p.id, label: planName(p, locale) }))

  return (
    <>
      <section className="flex flex-col gap-2" aria-labelledby="plans-admin-check">
        <h2 id="plans-admin-check" className="flex flex-wrap items-center gap-2 text-base font-medium">
          {label}
          <code className="text-xs text-muted-foreground">{plan.key}</code>
        </h2>
        {plan.isDefault ? <p className="text-sm text-muted-foreground">{m.defaultHint}</p> : null}
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium">{m.checklistTitle}</h3>
          {check.sellable ? (
            <p className="text-sm">{m.checklistReady}</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {check.missing.map((k) => (
                <li key={k}>{m.checks[k]}</li>
              ))}
            </ul>
          )}
          {check.warnings.map((w) => (
            <p key={w} className="text-sm text-muted-foreground">
              {m.warnings[w]}
            </p>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="plans-admin-status">
        <h3 id="plans-admin-status" className="text-sm font-medium">
          {m.statusTitle}
        </h3>
        <PlanStatusActions
          key={`${plan.id}-${plan.active}-${plan.published}-${plan.isDefault}`}
          planId={plan.id}
          planLabel={label}
          published={plan.published}
          active={plan.active}
          isDefault={plan.isDefault}
          hasPlanRef={Boolean(plan.planRef)}
          replacements={replacements}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="plans-admin-edit">
        <h3 id="plans-admin-edit" className="text-sm font-medium">
          {m.editTitle}
        </h3>
        <PlanForm
          key={plan.id}
          plan={{
            id: plan.id,
            key: plan.key,
            nameEs: plan.nameEs,
            nameEn: plan.nameEn,
            descriptionEs: plan.descriptionEs ?? "",
            descriptionEn: plan.descriptionEn ?? "",
            planRef: plan.planRef ?? "",
            sort: plan.sort,
            priceNoteEs: plan.priceNoteEs ?? "",
            priceNoteEn: plan.priceNoteEn ?? "",
          }}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="plans-admin-ents">
        <h3 id="plans-admin-ents" className="text-sm font-medium">
          {m.entitlementsTitle}
        </h3>
        {plan.entitlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.entitlements.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {plan.entitlements.map((e) => (
              <li key={e.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex flex-col">
                  <span>{entitlementLabel(e, locale)}</span>
                  <span className="text-xs text-muted-foreground">
                    <code>{e.key}</code> ·{" "}
                    {e.kind === "feature"
                      ? e.enabled
                        ? copy.entitlements.included
                        : copy.entitlements.notIncluded
                      : e.limit === null
                        ? copy.entitlements.unlimited
                        : copy.entitlements.upTo(formatNumber(e.limit, locale))}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Link
                    href={href({ id: plan.id, key: e.key })}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {m.editEntitlement}
                  </Link>
                  <RemoveEntitlementButton planId={plan.id} entKey={e.key} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <h4 className="text-sm font-medium">{m.entitlementTitle}</h4>
        {editing ? (
          <Link href={href({ id: plan.id })} className="text-sm text-primary underline-offset-4 hover:underline">
            {m.clearEntitlement}
          </Link>
        ) : null}
        <EntitlementForm
          key={`${plan.id}-${editing?.key ?? "new"}`}
          planId={plan.id}
          knownKeys={knownKeys}
          initial={
            editing
              ? {
                  key: editing.key,
                  kind: editing.kind,
                  enabled: editing.enabled,
                  limit: editing.limit,
                  labelEs: editing.labelEs ?? "",
                  labelEn: editing.labelEn ?? "",
                }
              : undefined
          }
        />
      </section>
    </>
  )
}
