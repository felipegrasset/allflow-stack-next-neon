import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { formatDateTime, type Locale } from "@/modules/i18n/contracts"
import type { ModuleCopy } from "@/modules/i18n/contracts/server"

import type { es } from "../messages"
import type { RequestView } from "../server/queries"

type Copy = ModuleCopy<typeof es>

/** A list of requests; the open/closed state is said with text, not only colour. */
export function RequestList({
  items,
  label,
  copy,
  locale,
}: {
  items: RequestView[]
  label: string
  copy: Copy
  locale: Locale
}) {
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              {r.flowName}
              {" · "}
              <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt, locale)}</time>
            </p>
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-sm text-muted-foreground">
              {copy.request.requestedBy(r.requesterName ?? copy.request.unknownUser)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant={r.final ? "secondary" : "outline"}>
              {copy.request.state(r.stateLabel)}
            </Badge>
            <span className="sr-only">{r.closedAt ? copy.request.closedTag : copy.request.openTag}</span>
            <Link
              href={`/approvals/${r.id}`}
              className="rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {copy.request.open}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
