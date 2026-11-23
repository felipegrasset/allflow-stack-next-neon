import type { Metadata } from "next"
import Link from "next/link"

import {
  KitFooter,
  KitHeader,
  KitTheme,
} from "@/modules/kit-core/contracts"

import { coreEntry, kitGroups, type KitEntry } from "./catalogo"
import "./galeria.css"

export const metadata: Metadata = { title: "Kits de UI · Fulvia" }

/** Rosa Fulvia en OKLCH: matiz 4, croma 0.16. */
const FULVIA = { h: 4, c: 0.16 } as const

/** El isotipo de Fulvia con los colores del tema: anillo en tinta, tallo en rosa. */
function FulviaMark() {
  return (
    <svg
      className="kg-mark"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-30 20 20)">
        <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="4.5" />
        <path
          className="kg-stem"
          d="M13 29.5C17.5 31.5 17 23 18 20C19 17 18.5 8.5 23 10.5"
          strokeWidth="4.5"
        />
        <path
          className="kg-stem"
          d="M14.5 20H20"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

function Brand() {
  return (
    <span className="kg-brand">
      <FulviaMark />
      <span>Fulvia</span>
      <span className="kg-label">Kits</span>
    </span>
  )
}

function KitCard({ kit }: { kit: KitEntry }) {
  return (
    <li>
      <Link href={`/kits/${kit.slug}`} className="kg-card">
        <span className="kit-h3">{kit.title}</span>
        <span className="kit-small text-muted-foreground">
          {kit.description}
        </span>
        <span className="kg-go">Ver el kit →</span>
      </Link>
    </li>
  )
}

export default function KitsGallery() {
  const total = kitGroups.reduce((n, g) => n + g.kits.length, 0)
  return (
    <KitTheme h={FULVIA.h} c={FULVIA.c} className="kg">
      <KitHeader
        brand={<Brand />}
        brandHref="/kits"
        links={kitGroups.map((g) => ({ label: g.title, href: `#${g.id}` }))}
      />
      <main id="contenido">
        <section className="kit-container kit-section">
          <p className="kg-label">{total} kits · código propio</p>
          <h1 className="kit-display mt-3">
            Elige un punto de partida, construye con <span className="kg-em">calma</span>
          </h1>
          <p className="kit-lead mt-4 text-muted-foreground">
            Cada kit es una pantalla completa que cambia de marca con dos
            números: <code>--brand-h</code> y <code>--brand-c</code>.
          </p>
        </section>

        {kitGroups.map((g, i) => (
          <section
            key={g.id}
            id={g.id}
            className={i % 2 === 0 ? "kg-alt" : undefined}
            aria-labelledby={`g-${g.id}`}
          >
            <div className="kit-container kit-section">
              <h2 id={`g-${g.id}`} className="kit-h2">
                {g.title}
              </h2>
              <p className="kit-small mt-2 text-muted-foreground">{g.lead}</p>
              <ul className="kg-grid">
                {g.kits.map((k) => (
                  <KitCard key={k.slug} kit={k} />
                ))}
              </ul>
            </div>
          </section>
        ))}

        <section aria-labelledby="g-core">
          <div className="kit-container kit-section">
            <h2 id="g-core" className="kit-h2">
              La base
            </h2>
            <ul className="kg-grid">
              <KitCard kit={coreEntry} />
            </ul>
          </div>
        </section>
      </main>
      <KitFooter
        brand={<Brand />}
        tagline="Código propio, sin imágenes con licencia."
      />
    </KitTheme>
  )
}
