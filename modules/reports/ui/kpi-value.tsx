/** A KPI's figure, already formatted. `muted` for "no data". */
export function KpiValue({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <p
      className={
        muted
          ? "text-sm text-muted-foreground"
          : "font-mono text-3xl font-semibold tabular-nums text-foreground"
      }
    >
      {value}
    </p>
  )
}
