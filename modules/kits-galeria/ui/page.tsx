import type { Metadata } from "next"
import Link from "next/link"

import { KitFooter, KitHeader } from "@/modules/kit-core/contracts"

import { coreEntry, kitGroups, type KitEntry } from "./catalogo"

export const metadata: Metadata = { title: "Kits de UI" }

function KitCard({ kit }: { kit: KitEntry }) {
  return (
    <li>
      <Link
        href={`/kits/${kit.slug}`}
        className="kit-card flex h-full flex-col gap-2 p-5 transition-colors hover:bg-muted"
      >
        <span className="kit-h3">{kit.title}</span>
        <span className="kit-small text-muted-foreground">
          {kit.description}
        </span>
        <span className="kit-small mt-auto pt-2 font-medium text-primary">
          Ver el kit →
        </span>
      </Link>
    </li>
  )
}

export default function KitsGallery() {
  const total = kitGroups.reduce((n, g) => n + g.kits.length, 0)
  return (
    <div className="bg-background text-foreground">
      <KitHeader
        brand="Kits de UI"
        brandHref="/kits"
        links={kitGroups.map((g) => ({ label: g.title, href: `#${g.id}` }))}
      />
      <main id="contenido">
        <section className="kit-container kit-section">
          <p className="kit-eyebrow">{total} kits</p>
          <h1 className="kit-display mt-3">Elige un punto de partida</h1>
          <p className="kit-lead mt-4">
            Cada kit es una pantalla completa que cambia de marca con dos
            números: <code>--brand-h</code> y <code>--brand-c</code>.
          </p>
        </section>

        {kitGroups.map((g) => (
          <section
            key={g.id}
            id={g.id}
            className="kit-container kit-section"
            aria-labelledby={`g-${g.id}`}
          >
            <h2 id={`g-${g.id}`} className="kit-h2">
              {g.title}
            </h2>
            <p className="kit-small mt-2 text-muted-foreground">{g.lead}</p>
            <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
              {g.kits.map((k) => (
                <KitCard key={k.slug} kit={k} />
              ))}
            </ul>
          </section>
        ))}

        <section
          className="kit-container kit-section"
          aria-labelledby="g-core"
        >
          <h2 id="g-core" className="kit-h2">
            La base
          </h2>
          <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
            <KitCard kit={coreEntry} />
          </ul>
        </section>
      </main>
      <KitFooter brand="Kits de UI" tagline="Código propio, sin imágenes con licencia." />
    </div>
  )
}
