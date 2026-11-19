export type BreakdownItem = { label: string; value: number | null; display: string }

/** Width (0–100) of each bar relative to the largest value; negatives and nulls draw no bar. */
export function barWidths(values: (number | null)[]): number[] {
  const max = Math.max(0, ...values.map((v) => v ?? 0))
  return values.map((v) => (v && v > 0 && max > 0 ? (v / max) * 100 : 0))
}

/** Horizontal bars as an ordered list: the text carries the data, the bars are decoration. */
export function BreakdownBars({ items, label }: { items: BreakdownItem[]; label: string }) {
  const widths = barWidths(items.map((i) => i.value))
  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{item.display}</span>
          </div>
          <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${widths[i]}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}
