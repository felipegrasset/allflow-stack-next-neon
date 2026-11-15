import { formatNumber, type Locale } from "@/modules/i18n/contracts"
import type { ModuleCopy } from "@/modules/i18n/contracts/server"

import { entitlementLabel, type Entitlement } from "../contracts/domain"
import type { es } from "../messages"

type Copy = ModuleCopy<typeof es>

/** What a plan grants, as a definition list. No hooks: renders on server or client. */
export function EntitlementList({
  entitlements,
  copy,
  locale,
}: {
  entitlements: Entitlement[]
  copy: Copy
  locale: Locale
}) {
  if (entitlements.length === 0)
    return <p className="text-sm text-muted-foreground">{copy.entitlements.empty}</p>
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {entitlements.map((e) => (
        <div key={e.key} className="contents">
          <dt className="text-muted-foreground">{entitlementLabel(e, locale)}</dt>
          <dd className="text-right font-medium">
            {e.kind === "feature"
              ? e.enabled
                ? copy.entitlements.included
                : copy.entitlements.notIncluded
              : e.limit === null
                ? copy.entitlements.unlimited
                : copy.entitlements.upTo(formatNumber(e.limit, locale))}
          </dd>
        </div>
      ))}
    </dl>
  )
}
