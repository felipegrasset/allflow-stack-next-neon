export type SeriesPoint = {
  /** Axis label of the bucket (formatted date). */
  label: string
  value: number | null
  /** The value as shown in the accessible table (formatted, or "no data"). */
  display: string
}

const W = 600
const H = 200
const PAD_X = 12
const PAD_TOP = 12
const PAD_BOTTOM = 28

/** x/y of each point in the viewBox; null values stay null (gaps in the line). */
export function layoutSeries(values: (number | null)[]): ({ x: number; y: number } | null)[] {
  const known = values.filter((v): v is number => v !== null)
  const max = Math.max(0, ...known)
  const min = Math.min(0, ...known)
  const span = max - min || 1
  const step = values.length > 1 ? (W - PAD_X * 2) / (values.length - 1) : 0
  return values.map((v, i) =>
    v === null
      ? null
      : {
          x: PAD_X + i * step,
          y: PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM),
        }
  )
}

/** SVG path that breaks at null points instead of drawing them as zero. */
export function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = ""
  let pen = false
  for (const p of points) {
    if (!p) {
      pen = false
      continue
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)} `
    pen = true
  }
  return d.trim()
}

/**
 * Line chart drawn in SVG with theme tokens (no chart library). The SVG has a
 * text alternative (`alt`) and the data is repeated in a screen-reader table.
 */
export function SeriesChart({
  points,
  alt,
  caption,
  periodLabel,
  valueLabel,
}: {
  points: SeriesPoint[]
  alt: string
  caption: string
  periodLabel: string
  valueLabel: string
}) {
  const xy = layoutSeries(points.map((p) => p.value))
  const base = H - PAD_BOTTOM
  const tickIdx = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i)
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={alt}
        className="h-auto w-full overflow-visible"
      >
        {[0, 0.5, 1].map((g) => {
          const y = PAD_TOP + g * (base - PAD_TOP)
          return (
            <line
              key={g}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
            />
          )
        })}
        <path
          d={linePath(xy)}
          className="fill-none stroke-primary"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) =>
          p ? <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-primary" /> : null
        )}
        {tickIdx.map((i) => {
          const x = PAD_X + (points.length > 1 ? (i * (W - PAD_X * 2)) / (points.length - 1) : 0)
          const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
          return (
            <text
              key={i}
              x={x}
              y={H - 8}
              textAnchor={anchor}
              className="fill-muted-foreground text-[11px]"
            >
              {points[i].label}
            </text>
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{periodLabel}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <th scope="row">{p.label}</th>
              <td>{p.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
