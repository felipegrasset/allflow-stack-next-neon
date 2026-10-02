import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EMPTY_CELL, formatCell, type DomainCopy, type DomainRow, type FieldMeta } from "@/lib/domain/meta"

/**
 * The list of an entity: the columns marked `list`, the first one a link to
 * the detail. Server component, no state. Copied by AllFlow's genesis from
 * `genesis/templates/components/domain/`.
 */
export function EntityTable({
  fields,
  rows,
  hrefFor,
  copy,
  label,
}: {
  fields: FieldMeta[]
  rows: DomainRow[]
  hrefFor: (id: string) => string
  copy: DomainCopy
  /** Accessible name of the table. */
  label: string
}) {
  const columns = fields.filter((f) => f.list)
  const shown = columns.length > 0 ? columns : fields.slice(0, 1)
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          {shown.map((f) => (
            <TableHead key={f.name}>{f.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {shown.map((f, i) => {
              const raw = f.type === "relation" ? row[`${f.name}Label`] : row[f.name]
              const text = f.type === "relation" ? (raw ? String(raw) : EMPTY_CELL) : formatCell(f, raw, copy)
              const content =
                f.type === "enum" && raw ? <Badge variant="secondary">{text}</Badge> : <span>{text}</span>
              return (
                <TableCell key={f.name}>
                  {i === 0 ? (
                    <Link href={hrefFor(row.id)} className="font-medium underline-offset-4 hover:underline">
                      {text}
                    </Link>
                  ) : (
                    content
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
