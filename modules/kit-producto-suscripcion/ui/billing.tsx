"use client"

import { Check } from "lucide-react"
import { useState } from "react"

import { copy } from "./copy"

type Period = "monthly" | "yearly"

/** Selector mensual/anual y planes. Conecta el botón de cada plan a tu checkout (por ejemplo Paddle.Checkout.open). */
export function Plans() {
  const [period, setPeriod] = useState<Period>("yearly")
  return (
    <div>
      <div role="group" aria-label="Facturación" className="ps-toggle">
        {(
          [
            ["monthly", "Mensual"],
            ["yearly", "Anual · 2 meses gratis"],
          ] as const
        ).map(([p, l]) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {copy.plans.map((p) => {
          const price =
            period === "monthly" ? p.monthly : Math.round(p.yearly / 12)
          return (
            <li
              key={p.name}
              className="ps-card flex flex-col gap-4"
              data-featured={p.featured}
            >
              <h3 className="kit-h3">
                {p.name}
                {p.featured ? (
                  <span className="ps-badge ml-2">Más elegido</span>
                ) : null}
              </h3>
              <p aria-live="polite">
                <span className="kit-h1">US${price}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {"per" in p ? p.per : "al mes"}
                  {period === "yearly"
                    ? `, facturado US$${p.yearly} al año`
                    : ""}
                </span>
              </p>
              <ul className="grid gap-2 text-sm">
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />{" "}
                    {i}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="ps-btn mt-auto"
                data-variant={p.featured ? undefined : "ghost"}
              >
                {p.cta}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
