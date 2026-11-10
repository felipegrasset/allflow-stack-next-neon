"use client"

import { Minus, Plus, Undo2 } from "lucide-react"
import { useState, type CSSProperties } from "react"

import { EmptyState } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

type Entry = { t: string; what: string; habit?: string; amount?: number }

/** Anillos, registro rápido, historial del día y metas editables: comparten un solo estado. */
export function Today() {
  const [vals, setVals] = useState<Record<string, number>>(
    Object.fromEntries(copy.habits.map((h) => [h.id, h.start]))
  )
  const [goals, setGoals] = useState<Record<string, number>>(
    Object.fromEntries(copy.habits.map((h) => [h.id, h.goal]))
  )
  const [log, setLog] = useState<Entry[]>(copy.seed.map((s) => ({ ...s })))
  const [clock, setClock] = useState(14)

  function add(id: string) {
    const h = copy.habits.find((x) => x.id === id)!
    setVals((v) => ({ ...v, [id]: v[id] + h.step }))
    setLog((l) => [
      {
        t: `${String(clock).padStart(2, "0")}:00`,
        what: h.add,
        habit: id,
        amount: h.step,
      },
      ...l,
    ])
    setClock((c) => (c >= 22 ? 8 : c + 1))
  }
  function undo() {
    const last = log.find((e) => e.habit)
    if (!last) return
    setVals((v) => ({
      ...v,
      [last.habit!]: Math.max(0, v[last.habit!] - (last.amount ?? 0)),
    }))
    setLog((l) => l.filter((e) => e !== last))
  }

  return (
    <div className="dh-today">
      <ul className="dh-rings">
        {copy.habits.map((h) => {
          const pct = Math.min(
            100,
            Math.round((vals[h.id] / goals[h.id]) * 100)
          )
          return (
            <li key={h.id} className="kit-card dh-ring-card">
              <div
                className="dh-ring"
                style={{ "--_p": pct } as CSSProperties}
                role="img"
                aria-label={copy.ringAria(
                  h.label,
                  vals[h.id],
                  goals[h.id],
                  h.unit
                )}
              >
                <span>{pct}%</span>
              </div>
              <span className="dh-ring__label">{h.label}</span>
              <span className="kit-small">
                {vals[h.id]} de {goals[h.id]} {h.unit}
              </span>
              {pct >= 100 ? (
                <span className="dh-badge">{copy.done}</span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="dh-quick" className="dh-block">
        <h3 id="dh-quick" className="kit-h3">
          {copy.quickTitle}
        </h3>
        <div className="dh-quick">
          {copy.habits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="dh-btn"
              onClick={() => add(h.id)}
            >
              <Plus className="size-4" aria-hidden="true" />
              {h.add}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="dh-log" className="dh-block">
        <div className="dh-row">
          <h3 id="dh-log" className="kit-h3">
            {copy.logTitle}
          </h3>
          <button
            type="button"
            className="dh-btn"
            data-quiet="true"
            onClick={undo}
            disabled={!log.some((e) => e.habit)}
          >
            <Undo2 className="size-4" aria-hidden="true" />
            {copy.undo}
          </button>
        </div>
        {log.length ? (
          <ul className="dh-log" aria-live="polite">
            {log.map((e, i) => (
              <li key={`${e.t}-${i}`}>
                <time>{e.t}</time>
                <span>{e.what}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            title={copy.logEmpty.title}
            description={copy.logEmpty.description}
            action={{ label: copy.logEmpty.action, onClick: () => add("agua") }}
          />
        )}
      </section>

      <section id="metas" aria-labelledby="dh-goals" className="dh-block">
        <h3 id="dh-goals" className="kit-h3">
          {copy.goalsTitle}
        </h3>
        <p className="kit-small">{copy.goalsLead}</p>
        <ul className="dh-goals">
          {copy.habits.map((h) => (
            <li key={h.id}>
              <span id={`dh-g-${h.id}`}>{copy.goalLabel(h.label)}</span>
              <span
                className="dh-stepper"
                role="group"
                aria-labelledby={`dh-g-${h.id}`}
              >
                <button
                  type="button"
                  aria-label={`Bajar la meta de ${h.label}`}
                  onClick={() =>
                    setGoals((g) => ({
                      ...g,
                      [h.id]: Math.max(h.step, g[h.id] - h.step),
                    }))
                  }
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <output>
                  {goals[h.id]} {h.unit}
                </output>
                <button
                  type="button"
                  aria-label={`Subir la meta de ${h.label}`}
                  onClick={() =>
                    setGoals((g) => ({ ...g, [h.id]: g[h.id] + h.step }))
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function Reminders() {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(copy.reminders.map((r) => [r.id, r.on]))
  )
  return (
    <ul className="dh-reminders">
      {copy.reminders.map((r) => (
        <li key={r.id}>
          <span className="dh-reminder__text">
            <span id={`dh-r-${r.id}`} className="font-semibold">
              {r.t}
            </span>
            <span className="kit-small">{r.when}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on[r.id]}
            aria-labelledby={`dh-r-${r.id}`}
            className="dh-switch"
            onClick={() => setOn((s) => ({ ...s, [r.id]: !s[r.id] }))}
          >
            <span aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
