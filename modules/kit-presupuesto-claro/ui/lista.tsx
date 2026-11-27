"use client"

import { Search } from "lucide-react"
import { useState } from "react"

import { NoResultsState } from "@/modules/kit-core/contracts"

import { clp, copy, statusLabel, type Status } from "./copy"

const filters: ("todos" | Status)[] = ["todos", "borrador", "enviado", "aceptado", "vencido"]

export function Lista() {
  const [q, setQ] = useState("")
  const [f, setF] = useState<"todos" | Status>("todos")

  const shown = copy.list.filter(
    (p) =>
      (f === "todos" || p.status === f) &&
      `${p.client} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase())
  )
  const clear = () => {
    setQ("")
    setF("todos")
  }

  return (
    <div className="pz-lista">
      <div className="pz-field">
        <label htmlFor="pz-q">Buscar por cliente o número</label>
        <div className="pz-search">
          <Search className="size-4" aria-hidden="true" />
          <input
            id="pz-q"
            type="search"
            className="pz-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="pz-chips" role="group" aria-label="Filtrar por estado">
        {filters.map((s) => (
          <button
            key={s}
            type="button"
            className="pz-chip"
            aria-pressed={f === s}
            onClick={() => setF(s)}
          >
            {s === "todos" ? "Todos" : statusLabel[s]}
          </button>
        ))}
      </div>
      <p className="pz-small" role="status">
        {shown.length} {shown.length === 1 ? "presupuesto" : "presupuestos"}
      </p>
      {shown.length === 0 ? (
        <NoResultsState
          compact
          title="Ningún presupuesto coincide"
          description="Prueba con otro nombre o quita el filtro de estado."
          action={{ label: "Quitar filtros", onClick: clear }}
        />
      ) : (
        <ul className="pz-rows">
          {shown.map((p) => (
            <li key={p.id} className="pz-row">
              <div>
                <p className="pz-row-name">{p.client}</p>
                <p className="pz-small">
                  {p.id} · {p.when}
                </p>
              </div>
              <p className="pz-num pz-row-total">{clp(p.total)}</p>
              <p className="pz-badge" data-status={p.status}>
                {statusLabel[p.status]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
