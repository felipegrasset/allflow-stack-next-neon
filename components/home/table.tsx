"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { HomeEmptyState } from "./empty"
import { RowsTable } from "./rows-table"
import type { HomeColumn, HomeEmpty, HomeRow } from "./types"

/** `table`: a big table with a text filter and optional per-column filters. */
export function TableHome({
  title,
  columns,
  rows,
  filterKeys = [],
  searchLabel = "Buscar",
  allLabel = "Todos",
  empty,
}: {
  title: string
  columns: HomeColumn[]
  rows: HomeRow[]
  /** Columns that get a dropdown built from their distinct values. */
  filterKeys?: string[]
  searchLabel?: string
  allLabel?: string
  empty: HomeEmpty
}) {
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Record<string, string>>({})

  const options = useMemo(
    () =>
      Object.fromEntries(filterKeys.map((k) => [k, [...new Set(rows.map((r) => r.cells[k]).filter(Boolean))].sort()])),
    [filterKeys, rows]
  )

  const shown = rows.filter(
    (r) =>
      Object.entries(picked).every(([k, v]) => !v || r.cells[k] === v) &&
      (!q || Object.values(r.cells).some((c) => c.toLowerCase().includes(q.toLowerCase())))
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64"
        />
        {filterKeys.map((k) => (
          <select
            key={k}
            aria-label={columns.find((c) => c.key === k)?.label ?? k}
            value={picked[k] ?? ""}
            onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.value }))}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">
              {columns.find((c) => c.key === k)?.label}: {allLabel}
            </option>
            {options[k].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ))}
      </div>
      {shown.length === 0 ? <HomeEmptyState {...empty} /> : <RowsTable columns={columns} rows={shown} />}
    </div>
  )
}
