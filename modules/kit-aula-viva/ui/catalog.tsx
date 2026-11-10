"use client"

import { BookOpen } from "lucide-react"
import { useState } from "react"

import { NoResultsState } from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Catálogo de cursos filtrable por nivel. Cada tarjeta lleva una portada hecha con tokens. */
export function Catalog() {
  const c = copy.catalog
  const [level, setLevel] = useState("Todos")
  const list = c.courses.filter((x) => level === "Todos" || x.level === level)
  return (
    <div className="av-catalog">
      <div className="av-chips" role="group" aria-label="Nivel">
        {c.levels.map((l) => (
          <button
            key={l}
            type="button"
            className="av-chip"
            aria-pressed={level === l}
            onClick={() => setLevel(l)}
          >
            {l}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="av-courses">
          {list.map((x, i) => (
            <li key={x.id} className="kit-card av-course">
              <div className="av-cover" data-i={i % 4} aria-hidden="true">
                <BookOpen className="size-6" />
              </div>
              <div className="av-course__body">
                <p className="kit-small">
                  {x.level}
                  {x.tag ? <span className="av-tag">{x.tag}</span> : null}
                </p>
                <h3 className="kit-h3">{x.name}</h3>
                <p className="kit-small">{c.unit(x.lessons, x.hours)}</p>
                <p className="kit-small">
                  {c.by} {x.teacher}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <NoResultsState
          title={c.noneTitle}
          description={c.noneDescription}
          action={{ label: c.noneAction, onClick: () => setLevel("Todos") }}
        />
      )}
    </div>
  )
}
