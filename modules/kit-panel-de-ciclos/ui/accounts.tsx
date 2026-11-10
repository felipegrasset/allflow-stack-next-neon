"use client"

import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { NoResultsState } from "@/modules/kit-core/contracts"
import { copy, type Account } from "./copy"

const money = (n: number) =>
  "$ " + n.toLocaleString("es-CL", { maximumFractionDigits: 0 })

/** Tabla de cuentas con búsqueda y filtro de estado; en 375 px cada fila es una tarjeta. */
export function Accounts({ accounts }: { accounts: Account[] }) {
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return accounts.filter(
      (a) =>
        (filter === "all" || a.status === filter) &&
        (!needle ||
          a.name.toLowerCase().includes(needle) ||
          a.owner.toLowerCase().includes(needle))
    )
  }, [accounts, q, filter])
  const clear = () => {
    setQ("")
    setFilter("all")
  }

  return (
    <div className="pc-accounts">
      <div className="pc-toolbar">
        <div className="pc-search">
          <Search className="size-4" aria-hidden="true" />
          <label htmlFor="pc-q" className="sr-only">
            {copy.searchLabel}
          </label>
          <input
            id="pc-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>
        <div className="pc-chips" role="group" aria-label="Filtrar por estado">
          {copy.filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className="pc-chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="kit-small pc-count" role="status">
        {copy.results(rows.length)}
      </p>
      {rows.length === 0 ? (
        <NoResultsState
          compact
          description={copy.states.noResults.description}
          title={copy.states.noResults.title}
          action={{ label: copy.clearFilters, onClick: clear }}
        />
      ) : (
        <table className="pc-table">
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
            {rows.map((a) => (
              <tr key={a.id}>
                <th scope="row" data-label={copy.columns[0]}>
                  <span className="pc-name">{a.name}</span>
                  <span className="kit-small">Actualizada {a.updated}</span>
                </th>
                <td data-label={copy.columns[1]}>{a.owner}</td>
                <td data-label={copy.columns[2]}>{a.plan}</td>
                <td data-label={copy.columns[3]} className="pc-num">
                  {money(a.mrr)}
                </td>
                <td data-label={copy.columns[4]}>
                  <span className="pc-badge" data-status={a.status}>
                    {copy.status[a.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
