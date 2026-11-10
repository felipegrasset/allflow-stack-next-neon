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
import { Contact, Help } from "./help"
import "./ayuda.css"

export const metadata: Metadata = { title: "Kit Centro de Ayuda" }

export default function CentroDeAyuda() {
  const s = copy.states
  const st = copy.status
  return (
    <KitTheme h={330} c={0.14} className="ay">
      <KitHeader
        brand={copy.brand}
        brandHref="/kits/centro-de-ayuda"
        links={copy.links}
        actions={
          <a className="ay-btn" href="#contacto">
            {copy.headerAction}
          </a>
        }
      />
      <main id="contenido">
        <section className="ay-hero" aria-labelledby="ay-h1">
          <div className="kit-container">
            <div className="ay-hero__inner">
              <p className="kit-eyebrow">{copy.eyebrow}</p>
              <h1 id="ay-h1" className="kit-display">
                {copy.title}
              </h1>
              <p className="kit-lead">{copy.lead}</p>
            </div>
          </div>
        </section>
        <div className="kit-container ay-main">
          <Help />

          <div className="ay-two">
            <section id="estado" aria-labelledby="ay-estado">
              <h2 id="ay-estado" className="kit-h2">
                {st.title}
              </h2>
              <p className="kit-lead mt-2">{st.lead}</p>
              <ul className="ay-status">
                {st.items.map((i) => (
                  <li key={i.n}>
                    <span>
                      <strong>{i.n}</strong>
                      {i.d ? (
                        <span className="kit-small block">{i.d}</span>
                      ) : null}
                    </span>
                    <span className="ay-pill" data-s={i.s}>
                      {st.label[i.s as keyof typeof st.label]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section
              id="contacto"
              className="kit-card ay-panel"
              aria-labelledby="ay-contacto"
            >
              <h2 id="ay-contacto" className="kit-h2">
                {copy.contact.title}
              </h2>
              <p className="kit-small mt-2 mb-4">{copy.contact.lead}</p>
              <Contact />
            </section>
          </div>

          <section aria-labelledby="ay-estados">
            <h2 id="ay-estados" className="kit-h2">
              {s.title}
            </h2>
            <p className="kit-lead mt-2">{s.lead}</p>
            <div className="ay-states mt-5">
              <EmptyState
                compact
                title={s.empty.title}
                description={s.empty.description}
                action={{ label: s.empty.action, href: "#contacto" }}
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
                action={{ label: s.success.action, href: "#buscar" }}
              />
              <ForbiddenState
                compact
                title={s.forbidden.title}
                description={s.forbidden.description}
                action={{ label: s.forbidden.action, href: "#buscar" }}
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
