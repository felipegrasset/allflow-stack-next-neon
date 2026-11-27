"use client"

import { useRef, useState } from "react"

import {
  ErrorState,
  LoadingState,
  StateBlock,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { clp, copy } from "./copy"

type Phase = "listo" | "enviando" | "aceptado" | "cambios" | "error"

const lines = copy.startLines
const sub = lines.reduce((s, l) => s + l.qty * l.price, 0)
const disc = sub * 0.05
const net = sub - disc
const tax = net * copy.taxRate
const total = net + tax

/**
 * Documento que ve el cliente. «Aceptar» no guarda nada aquí: debe llamar a tu
 * acción de servidor, que fija el estado y el monto. La demo simula la espera.
 */
export function Documento() {
  const [phase, setPhase] = useState<Phase>("listo")
  const fail = useRef(false)

  function accept() {
    setPhase("enviando")
    window.setTimeout(() => {
      if (fail.current) {
        fail.current = false
        setPhase("error")
      } else setPhase("aceptado")
    }, 900)
  }

  return (
    <div className="pz-split">
      <article className="pz-sheet pz-paper" aria-labelledby="pz-doc-h">
        <header className="pz-paper-head">
          <div>
            <p className="pz-kicker">{copy.doc.issuer}</p>
            <h3 id="pz-doc-h" className="pz-title">
              Presupuesto {copy.doc.number}
            </h3>
          </div>
          {phase === "aceptado" ? (
            <p className="pz-stamp" role="status">
              Aceptado
            </p>
          ) : null}
        </header>
        <dl className="pz-meta">
          <div>
            <dt>Para</dt>
            <dd>{copy.doc.client}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{copy.doc.date}</dd>
          </div>
        </dl>
        <div className="pz-scroll" role="region" aria-label="Detalle del presupuesto" tabIndex={0}>
          <table className="pz-table">
            <caption className="sr-only">Líneas del presupuesto</caption>
            <thead>
              <tr>
                <th scope="col">Detalle</th>
                <th scope="col">Cant.</th>
                <th scope="col">Precio</th>
                <th scope="col">Importe</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.desc}</th>
                  <td className="pz-num">{l.qty}</td>
                  <td className="pz-num">{clp(l.price)}</td>
                  <td className="pz-num">{clp(l.qty * l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="pz-totals">
          <div>
            <dt>Subtotal</dt>
            <dd className="pz-num">{clp(sub)}</dd>
          </div>
          <div>
            <dt>Descuento (5 %)</dt>
            <dd className="pz-num">−{clp(disc)}</dd>
          </div>
          <div>
            <dt>IVA (19 %)</dt>
            <dd className="pz-num">{clp(tax)}</dd>
          </div>
          <div className="pz-grand">
            <dt>Total</dt>
            <dd className="pz-num">{clp(total)}</dd>
          </div>
        </dl>
        <p className="pz-small">{copy.doc.valid}. {copy.doc.note}</p>
      </article>

      <section className="pz-sheet pz-act" aria-labelledby="pz-act-h" aria-live="polite">
        <h3 id="pz-act-h" className="pz-title">
          Tu respuesta
        </h3>
        {phase === "listo" ? (
          <>
            <p>Revisa las líneas y el total. Puedes aceptar o pedir cambios.</p>
            <button type="button" className="pz-btn" onClick={accept}>
              Aceptar presupuesto
            </button>
            <button type="button" className="pz-btn" data-variant="ghost" onClick={() => setPhase("cambios")}>
              Pedir cambios
            </button>
            <button
              type="button"
              className="pz-btn"
              data-variant="quiet"
              onClick={() => {
                fail.current = true
                accept()
              }}
            >
              Simular un fallo al aceptar
            </button>
          </>
        ) : null}
        {phase === "enviando" ? <LoadingState compact title="Registrando tu aceptación" lines={2} /> : null}
        {phase === "aceptado" ? (
          <SuccessState
            compact
            title="Presupuesto aceptado"
            description="Avisamos a Estudio Ejemplo. Te llegará el anticipo por correo."
            action={{ label: "Volver a empezar", onClick: () => setPhase("listo") }}
          />
        ) : null}
        {phase === "cambios" ? (
          <StateBlock
            tone="info"
            title="Cuéntanos qué cambiarías"
            description="El mensaje llega a quien preparó el presupuesto y el documento queda en revisión."
            action={{ label: "Volver al documento", onClick: () => setPhase("listo") }}
          >
            <label htmlFor="pz-msg" className="pz-label">
              Tu mensaje
            </label>
            <textarea id="pz-msg" className="pz-input pz-area" rows={3} />
          </StateBlock>
        ) : null}
        {phase === "error" ? (
          <ErrorState
            compact
            title="No pudimos registrar la respuesta"
            description="Tu presupuesto sigue intacto. Inténtalo de nuevo."
            onRetry={accept}
          />
        ) : null}
      </section>
    </div>
  )
}
