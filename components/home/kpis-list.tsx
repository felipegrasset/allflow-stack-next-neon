import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HomeEmptyState } from "./empty"
import { RowsTable } from "./rows-table"
import type { HomeColumn, HomeEmpty, HomeKpi, HomeRow } from "./types"

/** `kpis+list`: 2–4 KPI cards and the latest rows of the primary entity. */
export function KpisListHome({
  title,
  kpis,
  listTitle,
  columns,
  rows,
  empty,
}: {
  title: string
  kpis: HomeKpi[]
  listTitle: string
  columns: HomeColumn[]
  rows: HomeRow[]
  empty: HomeEmpty
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.slice(0, 4).map((k) => (
            <Card key={k.label} size="sm" data-testid="home-kpi">
              <CardHeader>
                <CardDescription>{k.label}</CardDescription>
                <CardTitle className="text-2xl">{k.value}</CardTitle>
                {k.hint && <CardDescription>{k.hint}</CardDescription>}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium">{listTitle}</h2>
        {rows.length === 0 ? <HomeEmptyState {...empty} /> : <RowsTable columns={columns} rows={rows.slice(0, 10)} />}
      </section>
    </div>
  )
}
