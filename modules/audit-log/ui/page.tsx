import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { parseFilters } from "../server/filters"
import { requireAuditReader } from "../server/guard"
import { listAudit, listFacets } from "../server/queries"
import { DiffView } from "./diff-view"
import { activeLocale } from "./locale"

type SearchParams = Record<string, string | string[] | undefined>

const FIELDS = ["entity", "action", "actor", "from", "to"] as const

function value(sp: SearchParams, key: string): string {
  const v = sp[key]
  return ((Array.isArray(v) ? v[0] : v) ?? "").slice(0, 100)
}

/** /admin/audit — the log, newest first, with filters (GET) and "older" pagination. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAuditReader("/admin/audit")
  const sp = await searchParams
  const { filters, invalid } = parseFilters(sp)
  const [copy, locale, facets, { rows, nextCursor }] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    listFacets(),
    listAudit(filters),
  ])
  const filtered = FIELDS.some((f) => value(sp, f))

  const older = new URLSearchParams()
  for (const f of FIELDS) if (value(sp, f)) older.set(f, value(sp, f))
  if (nextCursor) older.set("cursor", nextCursor)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      <form role="search" method="get" aria-label={copy.filters.label} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-entity" className="text-xs text-muted-foreground">{copy.filters.entity}</label>
          <NativeSelect id="audit-entity" name="entity" defaultValue={value(sp, "entity")}>
            <NativeSelectOption value="">{copy.filters.entityAll}</NativeSelectOption>
            {facets.entities.map((e) => (
              <NativeSelectOption key={e} value={e}>{e}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-xs text-muted-foreground">{copy.filters.action}</label>
          <Input id="audit-action" name="action" list="audit-actions" defaultValue={value(sp, "action")} maxLength={80} placeholder={copy.filters.actionHint} />
          <datalist id="audit-actions">
            {facets.actions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-actor" className="text-xs text-muted-foreground">{copy.filters.actor}</label>
          <Input id="audit-actor" name="actor" defaultValue={value(sp, "actor")} maxLength={100} placeholder={copy.filters.actorPlaceholder} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-from" className="text-xs text-muted-foreground">{copy.filters.from}</label>
          <Input id="audit-from" name="from" type="date" defaultValue={value(sp, "from")} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-to" className="text-xs text-muted-foreground">{copy.filters.to}</label>
          <Input id="audit-to" name="to" type="date" defaultValue={value(sp, "to")} />
        </div>
        <Button type="submit" variant="outline">{copy.filters.apply}</Button>
        {filtered ? (
          <ButtonLink href="/admin/audit" variant="ghost">{copy.filters.clear}</ButtonLink>
        ) : null}
      </form>

      {invalid ? (
        <p role="alert" className="text-sm text-destructive">{copy.filters.invalid}</p>
      ) : null}

      <p className="text-xs text-muted-foreground" aria-live="polite">{copy.count(rows.length)}</p>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">{filtered ? copy.emptyFiltered : copy.empty}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.when}</TableHead>
              <TableHead>{copy.columns.actor}</TableHead>
              <TableHead>{copy.columns.action}</TableHead>
              <TableHead className="hidden md:table-cell">{copy.columns.entity}</TableHead>
              <TableHead>{copy.columns.changes}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt, locale)}</time>
                </TableCell>
                <TableCell>{r.actorId === null ? copy.system : (r.actorName ?? copy.unknownActor)}</TableCell>
                <TableCell className="font-medium">{r.action}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {r.entity} · {r.entityId}
                </TableCell>
                <TableCell>
                  <DiffView diff={r.diff} copy={copy} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {nextCursor ? (
        <div>
          <ButtonLink href={`/admin/audit?${older.toString()}`} variant="outline">{copy.pager.older}</ButtonLink>
        </div>
      ) : null}
    </div>
  )
}
