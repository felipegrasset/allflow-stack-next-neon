"use client"

import { Check } from "lucide-react"
import { useState } from "react"

import {
  ErrorState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"

/** Rutas con sus pedidos y la línea de tiempo del pedido elegido. */
export function Board() {
  const [rid, setRid] = useState(copy.routes[0].id)
  const route = copy.routes.find((r) => r.id === rid)!
  const [code, setCode] = useState(route.orders[0].code)
  const order = route.orders.find((o) => o.code === code) ?? route.orders[0]

  return (
    <div className="rv-board">
      <div className="rv-routes" role="group" aria-label={copy.routeLabel}>
        {copy.routes.map((r) => (
          <button
            key={r.id}
            type="button"
            className="rv-route"
            aria-pressed={r.id === rid}
            onClick={() => {
              setRid(r.id)
              setCode(r.orders[0].code)
            }}
          >
            <span className="rv-route__name">{r.name}</span>
            <span className="kit-small">
              {r.driver} · {r.orders.length} pedidos
            </span>
          </button>
        ))}
      </div>
      <ul className="rv-orders">
        {route.orders.map((o) => (
          <li key={o.code}>
            <button
              type="button"
              className="rv-order"
              aria-pressed={o.code === order.code}
              onClick={() => setCode(o.code)}
            >
              <span className="rv-code">{o.code}</span>
              <span className="rv-order__text">
                <span className="rv-route__name">{o.client}</span>
                <span className="kit-small">{o.address}</span>
              </span>
              <span className="rv-tag" data-tone={o.late ? "danger" : "info"}>
                {o.late ? copy.late : copy.steps[o.step]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <section className="kit-card rv-timeline" aria-labelledby="rv-tl">
        <h3 id="rv-tl" className="kit-h3">
          {copy.timelineTitle} {order.code}
        </h3>
        <ol className="rv-steps">
          {copy.steps.map((s, i) => (
            <li
              key={s}
              data-state={
                i < order.step ? "done" : i === order.step ? "now" : "next"
              }
              aria-current={i === order.step ? "step" : undefined}
            >
              <span className="rv-dot" aria-hidden="true">
                {i < order.step ? <Check className="size-3" /> : null}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** Escaneo: un código conocido se registra; uno desconocido da error con salida. */
export function Scan() {
  const [v, setV] = useState("")
  const [res, setRes] = useState<null | "ok" | "bad" | "empty">(null)
  const s = copy.scan
  return (
    <div className="rv-scan">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const c = v.trim().toUpperCase()
          setRes(!c ? "empty" : s.known.includes(c) ? "ok" : "bad")
        }}
      >
        <label htmlFor="rv-code" className="rv-label">
          {s.label}
        </label>
        <div className="rv-scanrow">
          <input
            id="rv-code"
            value={v}
            onChange={(e) => {
              setV(e.target.value)
              setRes(null)
            }}
            autoComplete="off"
            placeholder="RV-0000"
          />
          <button type="submit" className="rv-btn">
            {s.cta}
          </button>
        </div>
      </form>
      {res === "ok" ? (
        <SuccessState
          compact
          title={s.okTitle}
          description={s.okText(v.trim().toUpperCase())}
        />
      ) : null}
      {res === "bad" ? (
        <ErrorState
          compact
          title={s.badTitle}
          description={s.badText}
          retryLabel={s.retry}
          onRetry={() => {
            setV("")
            setRes(null)
          }}
        />
      ) : null}
      {res === "empty" ? (
        <StateBlock tone="info" role="status" compact title={s.lead} />
      ) : null}
    </div>
  )
}
