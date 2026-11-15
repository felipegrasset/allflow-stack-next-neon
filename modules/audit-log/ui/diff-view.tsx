import { REDACTED, parseDiff } from "../contracts/diff"
import type { ModuleCopy } from "@/modules/i18n/contracts/server"

import type { es } from "../messages"

type Copy = ModuleCopy<typeof es>

function show(v: unknown, copy: Copy): string {
  if (v === REDACTED) return copy.changes.redacted
  const s = typeof v === "string" ? v : JSON.stringify(v)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

/** The changes of one row, collapsed: "3 fields" opens the list. Plain HTML, no client JS. */
export function DiffView({ diff, copy }: { diff: unknown; copy: Copy }) {
  const rows = parseDiff(diff)
  if (rows.length === 0) return <span className="text-muted-foreground">{copy.changes.none}</span>
  return (
    <details className="group">
      <summary className="cursor-pointer rounded-md text-sm text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {copy.changes.summary(rows.length)}
      </summary>
      <dl className="mt-2 flex flex-col gap-1 text-xs">
        {rows.map((r) => (
          <div key={r.field} className="flex flex-wrap gap-x-2">
            <dt className="font-medium">{r.field}</dt>
            <dd className="min-w-0 break-words">
              {r.hasFrom ? (
                <span className="text-muted-foreground line-through">
                  <span className="sr-only">{copy.changes.before}: </span>
                  {show(r.from, copy)}
                </span>
              ) : null}
              {r.hasFrom && r.hasTo ? " → " : null}
              {r.hasTo ? (
                <span>
                  <span className="sr-only">{copy.changes.after}: </span>
                  {show(r.to, copy)}
                </span>
              ) : null}
              {r.hasFrom && !r.hasTo ? (
                <span className="ml-1 text-muted-foreground">({copy.changes.removed})</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
