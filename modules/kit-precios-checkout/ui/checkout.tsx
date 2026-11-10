"use client"

import { Lock } from "lucide-react"
import { useState } from "react"

import { copy, usd } from "./copy"

/**
 * Checkout simple. El pago no se captura aquí: el botón debe abrir el pago del
 * proveedor (por ejemplo Paddle) con el plan, la periodicidad y el cupón.
 * No agregues campos de tarjeta a este formulario.
 */
export function Checkout() {
  const c = copy.checkout
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState(false)

  const discount = applied ? c.price * c.coupon.off : 0
  const net = c.price - discount
  const tax = net * c.taxRate
  const total = net + tax

  function apply() {
    const ok = code.trim().toUpperCase() === c.coupon.code
    setApplied(ok)
    setError(!ok)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form
        className="pc-card grid gap-4 lg:col-span-3"
        aria-labelledby="pc-pay"
      >
        <h3 id="pc-pay" className="kit-h2">
          Tus datos
        </h3>
        <div className="grid gap-1">
          <label htmlFor="pc-mail" className="text-sm font-medium">
            Correo para tu recibo
          </label>
          <input
            id="pc-mail"
            type="email"
            autoComplete="email"
            className="pc-input"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="pc-pais" className="text-sm font-medium">
            País (para calcular el impuesto)
          </label>
          <select id="pc-pais" className="pc-input" defaultValue="Chile">
            {c.countries.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="pc-cup" className="text-sm font-medium">
            Código de descuento
          </label>
          <div className="flex gap-2">
            <input
              id="pc-cup"
              className="pc-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={error}
              aria-describedby="pc-cup-msg"
            />
            <button
              type="button"
              className="pc-btn"
              data-variant="ghost"
              onClick={apply}
            >
              Aplicar
            </button>
          </div>
          <p
            id="pc-cup-msg"
            role={error ? "alert" : "status"}
            className="text-sm"
          >
            {applied
              ? `Código aplicado: ${Math.round(c.coupon.off * 100)} % de descuento.`
              : error
                ? "Ese código no es válido."
                : ""}
          </p>
        </div>
        <button type="button" className="pc-btn">
          <Lock className="mr-2 size-4" aria-hidden="true" /> Continuar al pago
          seguro
        </button>
        <p className="text-xs text-muted-foreground">
          El pago lo procesa nuestro proveedor de pagos; no vemos ni guardamos
          los datos de tu tarjeta.
        </p>
      </form>

      <aside
        className="pc-card flex flex-col gap-3 lg:col-span-2"
        aria-labelledby="pc-res"
      >
        <h3 id="pc-res" className="kit-h2">
          Resumen
        </h3>
        <p className="flex justify-between">
          <span>
            Plan {c.plan} ({c.period})
          </span>
          <span className="pc-num">{usd(c.price)}</span>
        </p>
        {applied ? (
          <p className="flex justify-between text-sm">
            <span>Descuento {c.coupon.code}</span>
            <span className="pc-num">−{usd(discount)}</span>
          </p>
        ) : null}
        <p className="flex justify-between text-sm">
          <span>Impuestos ({Math.round(c.taxRate * 100)} %)</span>
          <span className="pc-num">{usd(tax)}</span>
        </p>
        <p className="flex justify-between border-t border-border pt-3 text-lg font-bold">
          <span>Total</span>
          <span className="pc-num" aria-live="polite">
            {usd(total)}
          </span>
        </p>
      </aside>
    </div>
  )
}
