"use client"

import { useState } from "react"

import { StateBlock } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

const W = 560
const H = 200
const PAD = 28

function pts(values: number[], max: number, w = W, h = H, pad = PAD) {
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  return values.map(
    (v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const
  )
}

function Spark({ data }: { data: number[] }) {
  const p = pts(data, Math.max(...data), 100, 32, 3)
  return (
    <svg
      className="nc-spark"
      viewBox="0 0 100 32"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points={p.map((x) => x.join(",")).join(" ")} />
    </svg>
  )
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const fmt = (n: number) =>
  n.toLocaleString("es-CL", { maximumFractionDigits: 1 })

/** Período, KPIs, gráficos de línea y de barras, tabla de canales y detalle lateral. */
export function Analytics() {
  const [rid, setRid] = useState("7")
  const [sel, setSel] = useState<string | null>(null)
  const r = copy.ranges.find((x) => x.id === rid)!
  const max = Math.max(...r.revenue) * 1.1
  const line = pts(r.revenue, max)
  const maxO = Math.max(...r.orders) * 1.1
  const bars = r.orders.map((v, i) => ({
    v,
    x: PAD + (i * (W - PAD * 2)) / r.orders.length,
    h: (v / maxO) * (H - PAD * 2),
    w: ((W - PAD * 2) / r.orders.length) * 0.6,
  }))
  const channel = copy.channels.find((c) => c.id === sel)

  return (
    <div className="nc-stack">
      <div className="nc-range" role="group" aria-label={copy.rangeLabel}>
        {copy.ranges.map((x) => (
          <button
            key={x.id}
            type="button"
            className="nc-chip"
            aria-pressed={x.id === rid}
            onClick={() => setRid(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      <ul id="resumen" className="nc-kpis">
        {copy.kpis.map((k) => (
          <li key={k.id} className="kit-card nc-kpi">
            <span className="kit-small">{k.label}</span>
            <span className="nc-kpi__value">
              {fmt(
                k.id === "rev"
                  ? sum(r.revenue)
                  : k.id === "ord"
                    ? sum(r.orders)
                    : k.base
              )}
              <small> {k.unit}</small>
            </span>
            <span className="nc-delta" data-up={k.up}>
              {k.delta}
            </span>
            <Spark data={k.trend} />
          </li>
        ))}
      </ul>

      <div id="ingresos" className="nc-charts">
        <figure className="kit-card nc-chart">
          <figcaption className="kit-h3">{copy.lineTitle}</figcaption>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={copy.lineDesc(
              r.axis[0],
              r.axis[r.axis.length - 1],
              r.revenue.length
            )}
          >
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                className="nc-grid"
                x1={PAD}
                x2={W - PAD}
                y1={H - PAD - g * (H - PAD * 2)}
                y2={H - PAD - g * (H - PAD * 2)}
              />
            ))}
            <polyline
              className="nc-line"
              points={line.map((x) => x.join(",")).join(" ")}
            />
            {line.map(([x, y], i) => (
              <circle key={i} className="nc-dot" cx={x} cy={y} r="4" />
            ))}
            {line.map(([x], i) => (
              <text
                key={i}
                className="nc-axis"
                x={x}
                y={H - 8}
                textAnchor="middle"
              >
                {r.axis[i]}
              </text>
            ))}
          </svg>
          <table className="sr-only">
            <caption>{copy.lineTitle}</caption>
            <tbody>
              {r.axis.map((a, i) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  <td>{r.revenue[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
        <figure className="kit-card nc-chart">
          <figcaption className="kit-h3">{copy.barsTitle}</figcaption>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${copy.barsTitle}: ${r.orders.join(", ")}`}
          >
            {bars.map((b, i) => (
              <g key={i}>
                <rect
                  className="nc-bar"
                  x={b.x + b.w * 0.3}
                  y={H - PAD - b.h}
                  width={b.w}
                  height={b.h}
                  rx="4"
                />
                <text
                  className="nc-axis"
                  x={b.x + b.w * 0.8}
                  y={H - 8}
                  textAnchor="middle"
                >
                  {r.axis[i]}
                </text>
              </g>
            ))}
          </svg>
        </figure>
      </div>

      <div id="canales" className="nc-split">
        <section className="kit-card nc-panel" aria-labelledby="nc-tabla">
          <h3 id="nc-tabla" className="kit-h3">
            {copy.tableTitle}
          </h3>
          <table className="nc-table">
            <thead>
              <tr>
                {copy.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copy.channels.map((c) => (
                <tr key={c.id} data-sel={c.id === sel}>
                  <th scope="row" data-label={copy.columns[0]}>
                    <button
                      type="button"
                      className="nc-link"
                      aria-pressed={c.id === sel}
                      onClick={() => setSel(c.id === sel ? null : c.id)}
                    >
                      {c.name}
                    </button>
                  </th>
                  <td data-label={copy.columns[1]} className="nc-num">
                    {fmt(c.sessions * r.factor)}
                  </td>
                  <td data-label={copy.columns[2]} className="nc-num">
                    {fmt(c.conv)} %
                  </td>
                  <td data-label={copy.columns[3]} className="nc-num">
                    $ {fmt(c.rev * r.factor)} M
                  </td>
                  <td
                    data-label={copy.columns[4]}
                    className="nc-num"
                    data-neg={c.change < 0}
                  >
                    {c.change > 0 ? "+" : ""}
                    {fmt(c.change)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside
          className="kit-card nc-panel"
          aria-labelledby="nc-detalle"
          aria-live="polite"
        >
          <h3 id="nc-detalle" className="kit-h3">
            {copy.detailTitle}
          </h3>
          {channel ? (
            <>
              <p className="nc-detail__name">{channel.name}</p>
              <dl className="nc-dl">
                <div>
                  <dt>{copy.stat.sessions}</dt>
                  <dd>{fmt(channel.sessions * r.factor)}</dd>
                </div>
                <div>
                  <dt>{copy.stat.conv}</dt>
                  <dd>{fmt(channel.conv)} %</dd>
                </div>
                <div>
                  <dt>{copy.stat.rev}</dt>
                  <dd>$ {fmt(channel.rev * r.factor)} M</dd>
                </div>
              </dl>
              <p className="kit-small">{channel.note}</p>
              <button
                type="button"
                className="nc-btn"
                data-quiet="true"
                onClick={() => setSel(null)}
              >
                {copy.clear}
              </button>
            </>
          ) : (
            <StateBlock compact title={copy.detailEmpty} />
          )}
        </aside>
      </div>
    </div>
  )
}
