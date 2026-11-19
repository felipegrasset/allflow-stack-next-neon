import Link from "next/link"

import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { resolveText } from "../contracts/definition"
import { es } from "../messages"
import { requireReportPermission } from "../server/access"
import { requestLocale } from "../server/locale"
import { listDashboards } from "../server/queries"
import { EmptyState } from "./empty-state"

/** /reports — the list of dashboards (needs `report:view`). */
export default async function ReportsPage() {
  await requireReportPermission("view", "/reports")
  const [items, copy, locale] = await Promise.all([
    listDashboards(),
    getModuleCopy(es),
    requestLocale(),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.list.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.list.subtitle}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={copy.list.emptyTitle} description={copy.list.emptyHint} />
      ) : (
        <ul aria-label={copy.list.listLabel} className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/reports/${item.id}`}
                className="flex h-full flex-col gap-1 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                {item.ok ? (
                  <>
                    <span className="font-medium">{resolveText(item.dashboard.title, locale)}</span>
                    {item.dashboard.description ? (
                      <span className="text-sm text-muted-foreground">
                        {resolveText(item.dashboard.description, locale)}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {copy.list.cards(item.dashboard.cards.length)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-destructive">{copy.list.invalid(item.id)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
