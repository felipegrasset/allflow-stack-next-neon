import { getLocale } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DEFAULT_LOCALE, formatDateTime, isLocale } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { MAX_CSV_BYTES, MAX_ROWS } from "../contracts/parse"
import { listImportTargets, localize } from "../contracts/registry"
import { es } from "../messages"
import { requirePagePermission } from "../server/guard"
import { listRecentRuns } from "../server/queries"
import "../targets"
import { ImportWizard, type WizardTarget } from "./import-wizard"

/** /admin/import — needs `import:run`. */
export default async function ImportPage() {
  await requirePagePermission("/admin/import")
  const [copy, rawLocale] = await Promise.all([getModuleCopy(es), getLocale()])
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const runs = await listRecentRuns()
  const targets: WizardTarget[] = listImportTargets().map((t) => ({
    id: t.id,
    label: localize(t.label, locale),
    description: t.description ? localize(t.description, locale) : null,
    fields: t.fields.map((f) => ({ key: f.key, label: localize(f.label, locale), required: f.required === true })),
  }))
  const targetLabel = new Map(targets.map((t) => [t.id, t.label]))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.page.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.page.subtitle}</p>
      </div>

      {targets.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{copy.page.noTargets}</EmptyTitle>
            <EmptyDescription>{copy.page.noTargetsHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ImportWizard targets={targets} maxKb={Math.floor(MAX_CSV_BYTES / 1000)} maxRows={MAX_ROWS} />
      )}

      <section className="flex flex-col gap-3" aria-labelledby="csv-import-recent">
        <h2 id="csv-import-recent" className="text-base font-medium">
          {copy.page.recent}
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.page.noRuns}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.runs.file}</TableHead>
                <TableHead>{copy.runs.target}</TableHead>
                <TableHead>{copy.runs.status}</TableHead>
                <TableHead>{copy.runs.imported}</TableHead>
                <TableHead className="hidden sm:table-cell">{copy.runs.skipped}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.runs.by}</TableHead>
                <TableHead className="hidden lg:table-cell">{copy.runs.when}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.fileName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{targetLabel.get(r.target) ?? r.target}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "done" ? "secondary" : "destructive"}>
                      {r.status === "done" ? copy.runs.statusDone : copy.runs.statusFailed}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.importedRows}</TableCell>
                  <TableCell className="hidden sm:table-cell">{r.skippedRows}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {r.createdByName ?? copy.runs.unknownUser}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {formatDateTime(r.createdAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
