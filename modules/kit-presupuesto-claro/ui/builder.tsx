"use client"

import { Plus, Trash2 } from "lucide-react"
import { useRef, useState } from "react"

import { EmptyState } from "@/modules/kit-core/contracts"

import { clp, copy } from "./copy"

type Row = { id: number; desc: string; qty: string; price: string }

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Cálculo de demostración: el monto real lo fija el servidor al guardar. */
export function totals(rows: { qty: string; price: string }[], pct: string, iva: boolean) {
  const sub = rows.reduce((s, r) => s + num(r.qty) * num(r.price), 0)
  const off = Math.min(num(pct), 100) / 100
  const discount = sub * off
  const net = sub - discount
  const tax = iva ? net * copy.taxRate : 0
  return { sub, discount, net, tax, total: net + tax }
}

export function Builder() {
  const next = useRef(copy.startLines.length + 1)
  const [rows, setRows] = useState<Row[]>(
    copy.startLines.map((l) => ({
      id: l.id,
      desc: l.desc,
      qty: String(l.qty),
      price: String(l.price),
    }))
  )
  const [pct, setPct] = useState("5")
  const [iva, setIva] = useState(true)

  const t = totals(rows, pct, iva)
  const patch = (id: number, key: keyof Row, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
  const add = () =>
    setRows((rs) => [...rs, { id: next.current++, desc: "", qty: "1", price: "0" }])

  return (
    <div className="pz-split">
      <form className="pz-sheet" aria-labelledby="pz-armar-h" onSubmit={(e) => e.preventDefault()}>
        <h3 id="pz-armar-h" className="pz-title">
          Líneas del presupuesto
        </h3>
        {rows.length === 0 ? (
          <EmptyState
            compact
            title="Aún no hay líneas"
            description="Agrega un servicio o producto para ver el total."
            action={{ label: "Agregar la primera línea", onClick: add }}
          />
        ) : (
          <ul className="pz-lines">
            {rows.map((r, i) => (
              <li key={r.id} className="pz-line">
                <div className="pz-field pz-desc">
                  <label htmlFor={`pz-d-${r.id}`}>Descripción {i + 1}</label>
                  <input
                    id={`pz-d-${r.id}`}
                    className="pz-input"
                    value={r.desc}
                    onChange={(e) => patch(r.id, "desc", e.target.value)}
                  />
                </div>
                <div className="pz-field">
                  <label htmlFor={`pz-q-${r.id}`}>Cantidad</label>
                  <input
                    id={`pz-q-${r.id}`}
                    className="pz-input pz-num"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={r.qty}
                    onChange={(e) => patch(r.id, "qty", e.target.value)}
                  />
                </div>
                <div className="pz-field">
                  <label htmlFor={`pz-p-${r.id}`}>Precio unitario ($)</label>
                  <input
                    id={`pz-p-${r.id}`}
                    className="pz-input pz-num"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={r.price}
                    onChange={(e) => patch(r.id, "price", e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="pz-icon"
                  aria-label={`Quitar la línea ${i + 1}`}
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="pz-btn" data-variant="ghost" onClick={add}>
          <Plus className="mr-2 size-4" aria-hidden="true" /> Agregar línea
        </button>
        <div className="pz-opts">
          <div className="pz-field">
            <label htmlFor="pz-pct">Descuento (%)</label>
            <input
              id="pz-pct"
              className="pz-input pz-num"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>
          <label className="pz-check">
            <input type="checkbox" checked={iva} onChange={(e) => setIva(e.target.checked)} />
            <span>Sumar IVA ({Math.round(copy.taxRate * 100)} %)</span>
          </label>
        </div>
      </form>

      <aside className="pz-sheet pz-sum" aria-labelledby="pz-sum-h">
        <h3 id="pz-sum-h" className="pz-title">
          Resumen en vivo
        </h3>
        <dl className="pz-totals" aria-live="polite">
          <div>
            <dt>Subtotal</dt>
            <dd className="pz-num">{clp(t.sub)}</dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd className="pz-num">−{clp(t.discount)}</dd>
          </div>
          <div>
            <dt>IVA</dt>
            <dd className="pz-num">{clp(t.tax)}</dd>
          </div>
          <div className="pz-grand">
            <dt>Total</dt>
            <dd className="pz-num">{clp(t.total)}</dd>
          </div>
        </dl>
        <a href="#documento" className="pz-btn">
          Ver el documento del cliente
        </a>
      </aside>
    </div>
  )
}
