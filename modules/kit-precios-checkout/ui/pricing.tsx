"use client"

import { Check } from "lucide-react"
import { useState } from "react"

import { copy, usd } from "./copy"

export function Pricing() {
  const [yearly, setYearly] = useState(true)
  return (
    <div>
      <div role="group" aria-label="Facturación" className="pc-toggle">
        <button
          type="button"
          aria-pressed={!yearly}
          onClick={() => setYearly(false)}
        >
          Mensual
        </button>
        <button
          type="button"
          aria-pressed={yearly}
          onClick={() => setYearly(true)}
        >
          Anual · 2 meses gratis
        </button>
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {copy.plans.map((p) => (
          <li
            key={p.id}
            className="pc-card flex flex-col gap-4"
            data-featured={p.featured ?? false}
          >
            <div>
              <h3 className="kit-h3">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.blurb}</p>
            </div>
            <p aria-live="polite">
              <span className="pc-num kit-h1">
                {usd(yearly ? p.yearly / 12 : p.monthly)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">al mes</span>
              {yearly ? (
                <span className="block text-xs text-muted-foreground">
                  Facturado {usd(p.yearly)} al año
                </span>
              ) : null}
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
            <a
              href="#pagar"
              className="pc-btn mt-auto"
              data-variant={p.featured ? undefined : "ghost"}
            >
              Elegir {p.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
