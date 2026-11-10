import type { Metadata } from "next"

import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  KitFooter,
  KitHeader,
  KitTheme,
  LoadingState,
  NoResultsState,
  OfflineState,
  PartialState,
  SuccessState,
} from "@/modules/kit-core/contracts"

import { copy } from "./copy"
import { Directory } from "./directory"
import "./directorio.css"

export const metadata: Metadata = { title: "Kit Directorio Claro" }

export default function DirectorioClaro() {
  const s = copy.states
  const p = copy.panel
  return (
    <KitTheme h={240} c={0.14} className="dcx">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/directorio-claro"
        links={copy.links}
        actions={
          <a className="dc-btn" href="#panel">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido" className="kit-container">
        <section className="dc-hero" aria-labelledby="dc-h1">
          <p className="kit-eyebrow">{copy.eyebrow}</p>
          <h1 id="dc-h1" className="kit-h1 mt-2">
            {copy.title}
          </h1>
          <p className="kit-lead mt-2">{copy.lead}</p>
        </section>
        <div className="dc-main">
          <Directory />

          <section id="panel" aria-labelledby="dc-panel">
            <h2 id="dc-panel" className="kit-h2">
              {p.title}
            </h2>
            <p className="kit-lead mt-2">{p.lead}</p>
            <ul className="dc-stats">
              {p.stats.map((x) => (
                <li key={x.l} className="kit-card dc-stat">
                  <span className="kit-small">{x.l}</span>
                  <span className="dc-stat__v">{x.v}</span>
                  <span className="dc-delta">{x.d}</span>
                </li>
              ))}
            </ul>
            <ul className="dc-own">
              {p.rows.map((r) => (
                <li key={r.t}>
                  <span className="font-semibold">{r.t}</span>
                  <span>
                    {r.v} {r.v === 1 ? "visita" : "visitas"}
                  </span>
                  <span>
                    {r.c} {r.c === 1 ? "contacto" : "contactos"}
                  </span>
                  <span
                    className="dc-tag"
                    data-st={r.s === "Activo" ? "ok" : "rev"}
                  >
                    {r.s}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="dc-estados">
            <h2 id="dc-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="dc-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#buscar" }}
              />
              <LoadingState compact title={s.loading} lines={3} />
              <ErrorState
                compact
                title={s.error.title}
                description={s.error.description}
                retryHref="#buscar"
              />
              <SuccessState
                compact
                title={s.success.title}
                description={s.success.description}
                action={{ label: s.success.action, href: "#panel" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#panel" }}
              />
              <NoResultsState
                compact
                title={s.noResults.title}
                description={s.noResults.description}
              />
              <OfflineState
                compact
                title={s.offline.title}
                description={s.offline.description}
                retryHref="#buscar"
              />
              <PartialState compact issues={s.partial.issues} />
            </div>
          </section>
        </div>
      </main>
      <KitFooter
        brand={copy.brand}
        tagline={copy.footer.tagline}
        columns={copy.footer.columns}
      />
    </KitTheme>
  )
}
