"use client"

import { useState } from "react"

import { copy, type Deal } from "./copy"

const money = (n: number) =>
  "$ " +
  (n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 }) +
  " M"

/** Tablero por etapas: cada tarjeta se mueve con un selector (también con teclado). */
export function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>(copy.deals)
  const [live, setLive] = useState("")
  const move = (d: Deal, stage: string) => {
    setDeals((all) => all.map((x) => (x.id === d.id ? { ...x, stage } : x)))
    setLive(
      `«${d.name}» pasó a ${copy.stages.find((s) => s.id === stage)?.name}.`
    )
  }
  return (
    <div>
      <div className="tc-board">
        {copy.stages.map((st) => {
          const list = deals.filter((d) => d.stage === st.id)
          const total = list.reduce((a, d) => a + d.value, 0)
          return (
            <section
              key={st.id}
              className="tc-col"
              aria-labelledby={`tc-st-${st.id}`}
            >
              <header>
                <h3 id={`tc-st-${st.id}`} className="tc-col__title">
                  {st.name}
                </h3>
                <span className="kit-small">
                  {list.length} · {money(total)}
                </span>
              </header>
              {list.length ? (
                <ul className="tc-cards">
                  {list.map((d) => (
                    <li
                      key={d.id}
                      className="kit-card tc-deal"
                      data-won={st.id === "won"}
                    >
                      <span className="tc-deal__name">{d.name}</span>
                      <span className="kit-small">{d.company}</span>
                      <span className="tc-deal__value">{money(d.value)}</span>
                      <select
                        className="tc-select"
                        aria-label={copy.moveLabel(d.name)}
                        value={d.stage}
                        onChange={(e) => move(d, e.target.value)}
                      >
                        {copy.stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tc-empty kit-small">{copy.emptyStage}</p>
              )}
            </section>
          )
        })}
      </div>
      <p className="sr-only" role="status">
        {live}
      </p>
    </div>
  )
}
