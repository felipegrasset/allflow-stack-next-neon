import Link from "next/link"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HomeColumn, HomeRow } from "./types"

/** Plain server-rendered table shared by `kpis+list` (the filterable one is `table`). */
export function RowsTable({ columns, rows }: { columns: HomeColumn[]; rows: HomeRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {columns.map((c, i) => (
                <TableCell key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                  {i === 0 && r.href ? (
                    <Link href={r.href} className="font-medium hover:underline">
                      {r.cells[c.key]}
                    </Link>
                  ) : (
                    r.cells[c.key]
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
